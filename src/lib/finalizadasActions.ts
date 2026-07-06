"use server";

import { getCompradorSession } from "./compradorSession";
import { prisma } from "@/src/lib/prisma";
import type { FiltrosFinalizadas, LicitacionFinalizada } from "./finalizadasTypes";

const LIMIT = 25;

function buildDateRange(
  ventana: string,
  desde: string,
  hasta: string
): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  let gte: Date | undefined;
  let lte: Date | undefined;

  switch (ventana) {
    case "semana":
      gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "mes":
      gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "tres_meses":
      gte = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "seis_meses":
      gte = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case "personalizado":
      if (desde) gte = new Date(desde);
      if (hasta) lte = new Date(hasta);
      break;
    default:
      return null;
  }

  if (!gte && !lte) return null;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function buildWhere(filtros: FiltrosFinalizadas, compradorId?: string) {
  const estados =
    filtros.estados.length > 0 ? filtros.estados : ["Finalizada", "Cancelada"];

  const fechaCreacionRange = buildDateRange(
    filtros.fechaCreacionVentana,
    filtros.fechaCreacionDesde,
    filtros.fechaCreacionHasta
  );

  const fechaInicioRange = buildDateRange(
    filtros.fechaInicioVentana,
    filtros.fechaInicioDesde,
    filtros.fechaInicioHasta
  );

  const fechaFinRange = buildDateRange(
    filtros.fechaFinVentana,
    filtros.fechaFinDesde,
    filtros.fechaFinHasta
  );

  return {
    eliminado: false,
    estado: { in: estados },
    ...(compradorId ? { compradorId } : {}),
    ...(filtros.jerarquia ? { jerarquia: filtros.jerarquia } : {}),
    ...(fechaCreacionRange ? { fechaCreacion: fechaCreacionRange } : {}),
    ...(fechaInicioRange ? { fechaInicioLicitacion: fechaInicioRange } : {}),
    ...(fechaFinRange
      ? {
          OR: [
            { fechaFinalizada: fechaFinRange },
            { fechaCancelada: fechaFinRange },
          ],
        }
      : {}),
  };
}

export async function buscarFinalizadasAction(
  filtros: FiltrosFinalizadas,
  cursor: string | null
): Promise<{ licitaciones: LicitacionFinalizada[]; nextCursor: string | null }> {
  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const rows = await prisma.licitacion.findMany({
    where: buildWhere(filtros, puedeVerTodo ? undefined : compradorId),
    orderBy: { fechaCreacion: "desc" },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      numero: true,
      modoLicitacion: true,
      jerarquia: true,
      estado: true,
      fechaInicioLicitacion: true,
      fechaCerrada: true,
      fechaFinalizada: true,
      fechaCancelada: true,
      _count: { select: { items: true, proveedoresInvitados: true } },
      asignaciones: { select: { cantidadAsignada: true, precioUnitario: true } },
    },
  });

  const hasMore = rows.length > LIMIT;
  const batch = hasMore ? rows.slice(0, LIMIT) : rows;
  const nextCursor = hasMore ? batch[batch.length - 1].id : null;

  return {
    licitaciones: batch.map((l: any) => ({
      id: l.id,
      numero: l.numero,
      modoLicitacion: l.modoLicitacion,
      jerarquia: l.jerarquia,
      fechaInicio: l.fechaInicioLicitacion?.toISOString() ?? null,
      fechaCierre: l.fechaCerrada?.toISOString() ?? null,
      fechaFin: (l.fechaFinalizada ?? l.fechaCancelada)?.toISOString() ?? null,
      estado: l.estado,
      numItems: l._count.items,
      numProveedores: l._count.proveedoresInvitados,
      costoFinal: l.asignaciones.reduce(
        (sum: any, a: any) => sum + a.cantidadAsignada * a.precioUnitario,
        0
      ),
    })),
    nextCursor,
  };
}
