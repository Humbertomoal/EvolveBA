"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getProveedorIdActual } from "./proveedorSession";
import { getCompradorSession } from "./compradorSession";
import {
  LIMIT_ORDENES,
  type FiltrosOrdenes,
  type FiltrosOrdenesComprador,
  type OrdenCompradorRow,
  type OrdenCompraRow,
} from "./ordenesTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const FECHA_POR_ESTADO: Record<string, string> = {
  "En tránsito": "fechaEnTransito",
  Entregada: "fechaEntregada",
  Recibida: "fechaRecibida",
  Cancelada: "fechaCancelada",
};

export async function actualizarEstatusOrdenAction(
  ordenId: string,
  estado: string,
  basePath: string
): Promise<void> {
  const campoFecha = FECHA_POR_ESTADO[estado];
  await db.ordenCompra.update({
    where: { id: ordenId },
    data: {
      estado,
      ...(campoFecha ? { [campoFecha]: new Date() } : {}),
    },
  });
  revalidatePath(`${basePath}/proveedor/ordenes`);
  revalidatePath(`${basePath}/proveedor/ordenes/${ordenId}`);
  revalidatePath(`${basePath}/comprador/ordenes`);
  revalidatePath(`${basePath}/comprador/ordenes/${ordenId}`);
}

function buildFechaRange(
  filtros: FiltrosOrdenes
): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  switch (filtros.periodo) {
    case "semana":
      return { gte: new Date(now.getTime() - 7 * 86_400_000) };
    case "mes":
      return { gte: new Date(now.getTime() - 30 * 86_400_000) };
    case "3meses":
      return { gte: new Date(now.getTime() - 90 * 86_400_000) };
    case "personalizado": {
      const gte = filtros.fechaDesde ? new Date(filtros.fechaDesde) : undefined;
      const lte = filtros.fechaHasta
        ? new Date(filtros.fechaHasta + "T23:59:59")
        : undefined;
      return gte || lte
        ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) }
        : null;
    }
    default:
      return null;
  }
}

export async function buscarOrdenesCompradorAction(
  filtros: FiltrosOrdenesComprador,
  cursor: string | null
): Promise<{ ordenes: OrdenCompradorRow[]; nextCursor: string | null }> {
  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const fechaRange = buildFechaRange(filtros);

  const licitacionFilter = {
    ...(filtros.licitacionNumero ? { numero: filtros.licitacionNumero } : {}),
    ...(puedeVerTodo ? {} : { compradorId }),
  };

  const where = {
    ...(filtros.estados.length > 0 ? { estado: { in: filtros.estados } } : {}),
    ...(Object.keys(licitacionFilter).length > 0 ? { licitacion: licitacionFilter } : {}),
    ...(fechaRange ? { fechaCreacion: fechaRange } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await db.ordenCompra.findMany({
    where,
    orderBy: { fechaCreacion: "desc" },
    take: LIMIT_ORDENES + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      licitacion: { select: { numero: true, jerarquia: true } },
      proveedor: { select: { razonSocial: true } },
      _count: { select: { lineas: true } },
    },
  });

  const hasMore = rows.length > LIMIT_ORDENES;
  const batch = hasMore ? rows.slice(0, LIMIT_ORDENES) : rows;
  const nextCursor = hasMore ? batch[batch.length - 1].id : null;

  return {
    ordenes: batch.map((o: any) => ({
      id: o.id,
      numero: o.numero,
      licitacionNumero: o.licitacion.numero,
      jerarquia: o.licitacion.jerarquia,
      proveedorNombre: o.proveedor.razonSocial,
      totalLineas: o._count.lineas,
      fechaCreacion: (o.fechaCreacion as Date).toISOString(),
      fechaEstimadaEntrega: o.fechaEstimadaEntrega
        ? (o.fechaEstimadaEntrega as Date).toISOString()
        : null,
      estado: o.estado,
    })),
    nextCursor,
  };
}

export async function buscarOrdenesProveedorAction(
  filtros: FiltrosOrdenes,
  cursor: string | null
): Promise<{ ordenes: OrdenCompraRow[]; nextCursor: string | null }> {
  const proveedorId = await getProveedorIdActual();
  if (!proveedorId) return { ordenes: [], nextCursor: null };

  const fechaRange = buildFechaRange(filtros);

  const where = {
    proveedorId,
    ...(filtros.estados.length > 0 ? { estado: { in: filtros.estados } } : {}),
    ...(fechaRange ? { fechaCreacion: fechaRange } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await db.ordenCompra.findMany({
    where,
    orderBy: { fechaCreacion: "desc" },
    take: LIMIT_ORDENES + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      licitacion: { select: { numero: true, jerarquia: true } },
      lineas: { select: { subtotal: true } },
    },
  });

  const hasMore = rows.length > LIMIT_ORDENES;
  const batch = hasMore ? rows.slice(0, LIMIT_ORDENES) : rows;
  const nextCursor = hasMore ? batch[batch.length - 1].id : null;

  return {
    ordenes: batch.map((o: any) => ({
      id: o.id,
      numero: o.numero,
      licitacionNumero: o.licitacion.numero,
      jerarquia: o.licitacion.jerarquia,
      fechaCreacion: (o.fechaCreacion as Date).toISOString(),
      fechaEstimadaEntrega: o.fechaEstimadaEntrega
        ? (o.fechaEstimadaEntrega as Date).toISOString()
        : null,
      total: (o.lineas as { subtotal: number }[]).reduce(
        (s, l) => s + l.subtotal,
        0
      ),
      estado: o.estado,
    })),
    nextCursor,
  };
}
