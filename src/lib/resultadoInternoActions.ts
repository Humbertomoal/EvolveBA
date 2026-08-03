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
 * fórmulas. Si la generación del Excel falla, el correo queda sin adjunto
 * (se loguea en generarExcelHistoricoAdjunto); nunca lanza.
 */
export async function prepararResultadoInternoAction(
  licitacionId: string
): Promise<DatosResultadoInterno> {
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: {
      numero: true,
      compradorId: true,
      tiposCambio: true,
      monedaConsolidacion: true,
      items: {
        select: {
          id: true,
          cantidadSolicitada: true,
          precioObjetivo: true,
          moneda: true,
        },
      },
    },
  });
  if (!licitacion) return VACIO;

  const tiposCambio = parseTiposCambio(licitacion.tiposCambio);
  const monedaConsol = (licitacion as any).monedaConsolidacion ?? "MXN";

  const ofertas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId } },
    select: { licitacionItemId: true, ronda: true, precioUnitario: true },
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

  // Comprador asignado + su(s) supervisor(es) (rol esSupervisor, mismo cliente).
  const comprador = await prisma.usuario.findUnique({
    where: { id: licitacion.compradorId },
    select: { nombre: true, apellido: true, email: true, clienteId: true },
  });

  const supervisores = comprador
    ? await prisma.usuario.findMany({
        where: {
          clienteId: comprador.clienteId,
          activo: true,
          id: { not: licitacion.compradorId },
          rol: { esSupervisor: true },
        },
        select: { email: true },
      })
    : [];

  const destinatarios = [
    ...new Set(
      [comprador?.email, ...supervisores.map((s) => s.email)].filter(
        (email): email is string => !!email
      )
    ),
  ];

  // TEMP diagnóstico: por qué RESULTADO_INTERNO puede quedar sin destinatarios.
  console.log("###COLA_CORREOS### [resultadoInterno]", {
    compradorId: licitacion.compradorId,
    compradorEncontrado: !!comprador,
    compradorEmail: comprador?.email ?? null,
    supervisoresConEmail: supervisores.filter((s) => s.email).length,
    destinatarios: destinatarios.length,
  });

  const variables: Record<string, string> = {
    numeroLicitacion: licitacion.numero,
    nombreComprador: comprador ? `${comprador.nombre} ${comprador.apellido}`.trim() : "",
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

  const excelAdjunto = await generarExcelHistoricoAdjunto(licitacionId, licitacion.numero);

  return {
    variables,
    destinatarios,
    adjuntos: excelAdjunto ? [excelAdjunto] : [],
  };
}
