"use server";

import { prisma } from "@/src/lib/prisma";
import {
  calcularAnalisisPorItem,
  calcularResumenAhorro,
} from "@/src/lib/licitacionesAhorro";
import { generarTablaGanadores, type ItemTablaGanador } from "@/src/lib/plantillasCorreo";
import { formatImporte } from "@/src/lib/monedas";
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
  const resumen = calcularResumenAhorro(analisis, ofertas.length > 0);

  // Moneda predominante — mismo criterio que licitaciones-proceso/[id]/page.tsx.
  const monedaCounts = new Map<string, number>();
  for (const item of licitacion.items) {
    monedaCounts.set(item.moneda, (monedaCounts.get(item.moneda) ?? 0) + 1);
  }
  const monedaPredominante =
    [...monedaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MXN";

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

  const variables: Record<string, string> = {
    numeroLicitacion: licitacion.numero,
    nombreComprador: comprador ? `${comprador.nombre} ${comprador.apellido}`.trim() : "",
    presupuestoObjetivo: formatImporte(resumen.presupuestoObjetivoTotal, monedaPredominante),
    totalPrimeraRonda: formatImporte(resumen.primeraRondaTotal, monedaPredominante),
    mejorCostoTotal: formatImporte(resumen.mejorPrecioActualTotal, monedaPredominante),
    adherenciaPrecio: `${resumen.adherenciaPct.toFixed(1)}%`,
    ahorroTotal: formatImporte(resumen.ahorroTotal, monedaPredominante),
    tablaGanadores: generarTablaGanadores(itemsGanadores),
  };

  const excelAdjunto = await generarExcelHistoricoAdjunto(licitacionId, licitacion.numero);

  return {
    variables,
    destinatarios,
    adjuntos: excelAdjunto ? [excelAdjunto] : [],
  };
}
