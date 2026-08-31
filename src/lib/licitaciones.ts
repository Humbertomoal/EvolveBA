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
  /**
   * Cuándo salió el lote COMPLETO de invitaciones, o null si nunca se notificó.
   * La pantalla de lanzamiento lo usa para decidir entre "Notificar
   * participantes" y "Reenviar invitación" — y para mostrar la columna
   * "Invitación", que es lo único que distingue una Programada notificada de
   * una que nadie recibió (el estado no lo dice: ambas son "Programada").
   */
  invitacionesEnviadasEn: string | null;
};

/**
 * Mejor oferta de una partida para el panel de decisión.
 *
 * Los tres campos del ganador son nullables A PROPÓSITO: cuando una partida
 * recibió respuestas pero NINGUNA válida —el caso real de la licitación 0015,
 * donde el único proveedor que contestó marcó "no dispongo" en las 5 partidas—
 * no hay ganador que mostrar. Antes se tomaba la oferta más barata en crudo y
 * el panel anunciaba un ganador a $0.
 */
export type MejorOfertaItem = {
  productoNombre: string;
  /** null = ninguna oferta de la partida compite (todas "no dispongo"/precio 0). */
  ronda: number | null;
  precioUnitario: number | null;
  proveedorNombre: string | null;
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
      invitacionesEnviadasEn: true,
      _count: { select: { proveedoresInvitados: true } },
    },
  });

  return rows.map((r: any) => ({
    ...r,
    fechaCreacion: r.fechaCreacion.toISOString(),
    fechaEjecucion: r.fechaEjecucion?.toISOString() ?? null,
    fechaInicioLicitacion: r.fechaInicioLicitacion?.toISOString() ?? null,
    inicioRondaActual: r.inicioRondaActual?.toISOString() ?? null,
    invitacionesEnviadasEn: r.invitacionesEnviadasEn?.toISOString() ?? null,
    numProveedores: r._count.proveedoresInvitados,
  }));
}
