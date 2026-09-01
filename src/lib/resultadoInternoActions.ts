"use server";

import { prisma } from "@/src/lib/prisma";
import {
  calcularAnalisisPorItem,
  calcularResumenAhorro,
} from "@/src/lib/licitacionesAhorro";
import { generarTablaGanadores, type ItemTablaGanador } from "@/src/lib/plantillasCorreo";
import { formatImporte } from "@/src/lib/monedas";
import { notaTipoCambio, parseTiposCambio } from "@/src/lib/conversionMoneda";
import { generarExcelHistoricoAdjunto } from "@/src/lib/historicoPujasActions";
import type { AdjuntoCorreo } from "@/src/lib/emailService";
import { getDestinatariosLicitacion } from "@/src/lib/destinatariosComprador";

export type DatosResultadoInterno = {
  variables: Record<string, string>;
  destinatarios: string[];
  adjuntos: AdjuntoCorreo[];
};

const VACIO: DatosResultadoInterno = { variables: {}, destinatarios: [], adjuntos: [] };

/**
 * Arma variables, destinatarios (comprador + supervisor(es)) y adjunto Excel
 * para el correo RESULTADO_INTERNO. Reutiliza EXACTAMENTE la misma lógica de
 * cálculo que el tab "Mejores Precios" (licitacionesAhorro.ts) — no duplica
 * fórmulas. Si la generación del Excel falla, el correo se arma igual pero sin
 * adjunto. Nunca lanza: ante cualquier otro fallo devuelve datos vacíos, para
 * no romper el Promise.all de la cola de correos ni el cierre de la licitación.
 */
export async function prepararResultadoInternoAction(
  licitacionId: string
): Promise<DatosResultadoInterno> {
  try {
    const licitacion = await prisma.licitacion.findUnique({
      where: { id: licitacionId },
      select: {
        numero: true,
        compradorId: true,
        tiposCambio: true,
        monedaConsolidacion: true,
        items: {
          where: { eliminado: false },
          select: {
            id: true,
            cantidadSolicitada: true,
            precioObjetivo: true,
            moneda: true,
          },
        },
      },
    });
    if (!licitacion) {
      console.log("###COLA_CORREOS### [resultadoInterno] licitación no encontrada", {
        licitacionId,
      });
      return VACIO;
    }

    const tiposCambio = parseTiposCambio(licitacion.tiposCambio);
    const monedaConsol = (licitacion as any).monedaConsolidacion ?? "MXN";

    const ofertas = await prisma.ofertaItem.findMany({
      where: { licitacionItem: { licitacionId, eliminado: false } },
      // proveedorId y noDisponible los exige el modelo de línea base promedio,
      // que agrupa por proveedor y descarta lo no cotizado.
      select: {
        licitacionItemId: true,
        proveedorId: true,
        ronda: true,
        precioUnitario: true,
        noDisponible: true,
        noAplica: true,
      },
    });

    const analisis = calcularAnalisisPorItem(
      licitacion.items.map((i) => ({
        id: i.id,
        cantidadSolicitada: i.cantidadSolicitada,
        precioObjetivo: i.precioObjetivo,
        moneda: i.moneda,
      })),
      ofertas
    );
    const resumen = calcularResumenAhorro(analisis, ofertas.length > 0, tiposCambio, monedaConsol);
    const notaTC = notaTipoCambio(
      licitacion.items.map((i) => i.moneda),
      tiposCambio,
      monedaConsol
    );

    // Ganadores → tablaGanadores.
    const asignaciones = await prisma.asignacionMaterial.findMany({
      where: { licitacionId },
      select: {
        cantidadAsignada: true,
        precioUnitario: true,
        moneda: true,
        proveedor: { select: { razonSocial: true } },
        licitacionItem: {
          select: { producto: { select: { nombre: true, unidadMedida: true } } },
        },
      },
    });
    const itemsGanadores: ItemTablaGanador[] = asignaciones.map((a) => ({
      material: a.licitacionItem.producto.nombre,
      proveedor: a.proveedor.razonSocial,
      cantidad: a.cantidadAsignada,
      unidad: a.licitacionItem.producto.unidadMedida,
      precioUnitario: a.precioUnitario,
      moneda: a.moneda,
    }));

    // Comprador asignado + Gerente(s) de Compras. La resolución vive en
    // destinatariosComprador.ts, compartida con el aviso de respuesta del
    // proveedor: un solo lugar que tocar el día que cambien los roles.
    const { correos: destinatarios, nombreComprador } =
      await getDestinatariosLicitacion(licitacionId);

    const variables: Record<string, string> = {
      numeroLicitacion: licitacion.numero,
      nombreComprador,
      // Agregados en MXN (líneas convertidas con los tipos de cambio congelados).
      presupuestoObjetivo: formatImporte(resumen.presupuestoObjetivoTotal, monedaConsol),
      totalPrimeraRonda: formatImporte(resumen.primeraRondaTotal, monedaConsol),
      mejorCostoTotal: formatImporte(resumen.mejorPrecioActualTotal, monedaConsol),
      adherenciaPrecio: `${resumen.adherenciaPct.toFixed(1)}%`,
      ahorroTotal: formatImporte(resumen.ahorroTotal, monedaConsol),
      // Nota del TC usado; vacío si todo MXN (la línea de la plantilla se colapsa).
      notaTipoCambio: notaTC ?? "",
      tablaGanadores: generarTablaGanadores(itemsGanadores),
    };

    // El Excel va en su propio try/catch: si truena (o excede el límite de
    // adjunto), el correo se sigue ofreciendo SIN adjunto en vez de tumbar
    // todo el paso RESULTADO_INTERNO.
    let excelAdjunto: AdjuntoCorreo | null = null;
    try {
      excelAdjunto = await generarExcelHistoricoAdjunto(licitacionId, licitacion.numero);
      console.log("###COLA_CORREOS### [resultadoInterno] excel", {
        generado: !!excelAdjunto,
        nombre: excelAdjunto?.nombre ?? null,
        bytesBase64: excelAdjunto?.contenidoBase64.length ?? 0,
      });
    } catch (error) {
      console.error(
        "###COLA_CORREOS### [resultadoInterno] falló el Excel adjunto — se envía sin adjunto",
        error
      );
    }

    return {
      variables,
      destinatarios,
      adjuntos: excelAdjunto ? [excelAdjunto] : [],
    };
  } catch (error) {
    console.error(
      "###COLA_CORREOS### [resultadoInterno] fallo preparando resultado interno",
      { licitacionId },
      error
    );
    return VACIO;
  }
}
