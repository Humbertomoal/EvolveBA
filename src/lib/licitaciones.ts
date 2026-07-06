import { prisma } from "@/src/lib/prisma";

export type LicitacionRow = {
  id: string;
  numero: string;
  jerarquia: string | null;
  fechaCreacion: string;
  fechaEjecucion: string | null;
  fechaInicioLicitacion: string | null;
  costoObjetivo: number | null;
  estado: string;
  modoLicitacion: string;
  numProveedores: number;
  rondaActual: number;
  maxRondas: number;
  duracionRondaMinutos: number;
  inicioRondaActual: string | null;
  esperandoDecision: boolean;
};

export type MejorOfertaItem = {
  productoNombre: string;
  ronda: number;
  precioUnitario: number;
  proveedorNombre: string;
};

export async function getLicitacionesByEstado(
  estados: string[],
  compradorId?: string
): Promise<LicitacionRow[]> {
  const rows = await prisma.licitacion.findMany({
    where: {
      eliminado: false,
      estado: { in: estados },
      ...(compradorId ? { compradorId } : {}),
    },
    orderBy: { fechaCreacion: "desc" },
    select: {
      id: true,
      numero: true,
      jerarquia: true,
      fechaCreacion: true,
      fechaEjecucion: true,
      fechaInicioLicitacion: true,
      costoObjetivo: true,
      estado: true,
      modoLicitacion: true,
      rondaActual: true,
      maxRondas: true,
      duracionRondaMinutos: true,
      inicioRondaActual: true,
      esperandoDecision: true,
      _count: { select: { proveedoresInvitados: true } },
    },
  });

  return rows.map((r: any) => ({
    ...r,
    fechaCreacion: r.fechaCreacion.toISOString(),
    fechaEjecucion: r.fechaEjecucion?.toISOString() ?? null,
    fechaInicioLicitacion: r.fechaInicioLicitacion?.toISOString() ?? null,
    inicioRondaActual: r.inicioRondaActual?.toISOString() ?? null,
    numProveedores: r._count.proveedoresInvitados,
  }));
}
