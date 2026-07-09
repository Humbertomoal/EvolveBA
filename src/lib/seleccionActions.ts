"use server";

import { prisma } from "@/src/lib/prisma";
import { getCompradorSession } from "./compradorSession";
import { calcularAnalisisPorItem, calcularResumenAhorro } from "./licitacionesAhorro";
import type { FiltrosSeleccion, LicitacionSeleccion } from "./seleccionTypes";

const LIMIT = 25;

function buildWhere(filtros: FiltrosSeleccion, compradorId?: string) {
  const now = new Date();
  let fechaCerrada: { gte?: Date; lte?: Date } | undefined;

  if (filtros.fechaCierreVentana === "semana") {
    fechaCerrada = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  } else if (filtros.fechaCierreVentana === "mes") {
    fechaCerrada = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  } else if (filtros.fechaCierreVentana === "personalizado") {
    const gte = filtros.fechaCierreDesde ? new Date(filtros.fechaCierreDesde) : undefined;
    let lte: Date | undefined;
    if (filtros.fechaCierreHasta) {
      lte = new Date(filtros.fechaCierreHasta);
      lte.setHours(23, 59, 59, 999);
    }
    if (gte || lte) {
      fechaCerrada = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }
  }

  return {
    eliminado: false,
    estado: { in: ["Cerrada", "Finalizada", "Cancelada"] },
    ...(compradorId ? { compradorId } : {}),
    ...(filtros.jerarquia ? { jerarquia: filtros.jerarquia } : {}),
    ...(fechaCerrada ? { fechaCerrada } : {}),
  };
}

export async function buscarSeleccionAction(
  filtros: FiltrosSeleccion,
  cursor: string | null
): Promise<{ licitaciones: LicitacionSeleccion[]; nextCursor: string | null }> {
  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const rows = await prisma.licitacion.findMany({
    where: buildWhere(filtros, puedeVerTodo ? undefined : compradorId),
    orderBy: { fechaEjecucion: "desc" },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      numero: true,
      tipoLicitacion: true,
      fechaEjecucion: true,
      jerarquia: true,
      estado: true,
      importeVenta: true,
      costoObjetivo: true,
      asignaciones: { select: { cantidadAsignada: true, precioUnitario: true } },
    },
  });

  const hasMore = rows.length > LIMIT;
  const batch = hasMore ? rows.slice(0, LIMIT) : rows;
  const nextCursor = hasMore ? batch[batch.length - 1].id : null;
  const batchIds = batch.map((l) => l.id);

  // Una sola consulta trae los materiales + sus ofertas de TODAS las
  // licitaciones visibles en esta página (nunca de la base completa).
  const items =
    batchIds.length > 0
      ? await prisma.licitacionItem.findMany({
          where: { licitacionId: { in: batchIds } },
          select: {
            id: true,
            licitacionId: true,
            cantidadSolicitada: true,
            precioObjetivo: true,
            moneda: true,
            ofertas: { select: { ronda: true, precioUnitario: true } },
          },
        })
      : [];

  const itemsPorLicitacion = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsPorLicitacion.has(item.licitacionId)) {
      itemsPorLicitacion.set(item.licitacionId, []);
    }
    itemsPorLicitacion.get(item.licitacionId)!.push(item);
  }

  const licitaciones: LicitacionSeleccion[] = batch.map((l) => {
    const itemsLic = itemsPorLicitacion.get(l.id) ?? [];
    const ofertasLic = itemsLic.flatMap((i) =>
      i.ofertas.map((o) => ({
        licitacionItemId: i.id,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
      }))
    );
    const analisis = calcularAnalisisPorItem(itemsLic, ofertasLic);
    const resumenAhorro = calcularResumenAhorro(analisis, ofertasLic.length > 0);

    const monedaCounts = new Map<string, number>();
    for (const item of itemsLic) {
      monedaCounts.set(item.moneda, (monedaCounts.get(item.moneda) ?? 0) + 1);
    }
    const monedaPredominante =
      [...monedaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MXN";

    return {
      id: l.id,
      numero: l.numero,
      tipoLicitacion: l.tipoLicitacion,
      fechaEjecucion: l.fechaEjecucion?.toISOString() ?? null,
      jerarquia: l.jerarquia,
      estado: l.estado,
      importeVenta: l.importeVenta,
      costoObjetivoLicitacion: l.costoObjetivo,
      costoLicitacion: l.asignaciones.reduce(
        (sum, a) => sum + a.precioUnitario * a.cantidadAsignada,
        0
      ),
      monedaPredominante,
      resumenAhorro,
    };
  });

  return { licitaciones, nextCursor };
}
