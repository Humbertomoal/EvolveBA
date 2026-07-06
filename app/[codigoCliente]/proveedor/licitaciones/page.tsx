import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { prisma } from "@/src/lib/prisma";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import MisLicitacionesTabla from "./_components/MisLicitacionesTabla";

export type LicitacionProgramada = {
  id: string;
  numero: string;
  jerarquia: string | null;
  fechaCreacion: string;
  fechaEjecucion: string | null;
  fechaFinRangoEntrega: string | null;
  totalParticipantes: number;
  instrucciones: string | null;
};

export type LicitacionEnProceso = {
  id: string;
  numero: string;
  jerarquia: string | null;
  fechaCreacion: string;
  fechaEjecucion: string | null;
  fechaFinRangoEntrega: string | null;
  totalParticipantes: number;
  instrucciones: string | null;
  rondaActual: number;
  maxRondas: number;
  rondaFinMs: number | null;
  esperandoDecision: boolean;
  cotizóEnRondaActual: boolean;
};

export type SubEstadoFinalizada =
  | "en_espera"
  | "ganador"
  | "pendiente_confirmacion"
  | "no_seleccionado"
  | "completado";

export type LicitacionFinalizada = {
  id: string;
  numero: string;
  jerarquia: string | null;
  fechaEjecucion: string | null;
  estado: string;
  subEstado: SubEstadoFinalizada;
  confirmacionDeadlineMs: number | null;
};

function getSubEstadoYDeadline(
  asignaciones: { proveedorId: string; estatusProveedor: string; fechaLimiteConfirmacion: Date | null }[],
  proveedorId: string
): { subEstado: SubEstadoFinalizada; confirmacionDeadlineMs: number | null } {
  if (asignaciones.length === 0) return { subEstado: "en_espera", confirmacionDeadlineMs: null };
  const mias = asignaciones.filter((a) => a.proveedorId === proveedorId);
  if (mias.length === 0) return { subEstado: "no_seleccionado", confirmacionDeadlineMs: null };
  const todasCompletadas = mias.every(
    (a) => a.estatusProveedor === "Aprobado" || a.estatusProveedor === "Confirmado"
  );
  if (todasCompletadas) return { subEstado: "completado", confirmacionDeadlineMs: null };
  const deadlines = mias
    .filter((a) => a.estatusProveedor === "Pendiente" && a.fechaLimiteConfirmacion !== null)
    .map((a: any)=> a.fechaLimiteConfirmacion!.getTime());
  if (deadlines.length > 0) {
    return { subEstado: "pendiente_confirmacion", confirmacionDeadlineMs: Math.min(...deadlines) };
  }
  return { subEstado: "ganador", confirmacionDeadlineMs: null };
}

export default async function MisLicitacionesPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const proveedorId = await getProveedorIdActual();

  // Verify state transitions for active licitaciones
  if (proveedorId) {
    const licParaVerificar = await prisma.licitacion.findMany({
      where: {
        eliminado: false,
        modoLicitacion: { not: "Manual" },
        estado: { in: ["Programada", "En Proceso"] },
        proveedoresInvitados: { some: { proveedorId } },
      },
      select: { id: true },
    });
    await Promise.all(licParaVerificar.map(({ id }: any) => verificarYActualizarEstado(id)));
  }

  // Fetch all 3 groups in parallel (after state verification, states may have changed)
  const [programadasRaw, enProcesoRaw, finalizadasRaw] = await Promise.all([
    proveedorId
      ? prisma.licitacion.findMany({
          where: {
            eliminado: false,
            modoLicitacion: { not: "Manual" },
            estado: "Programada",
            proveedoresInvitados: { some: { proveedorId } },
          },
          orderBy: { fechaEjecucion: "asc" },
          select: {
            id: true,
            numero: true,
            jerarquia: true,
            fechaCreacion: true,
            fechaEjecucion: true,
            fechaFinRangoEntrega: true,
            instrucciones: true,
            _count: { select: { proveedoresInvitados: true } },
          },
        })
      : Promise.resolve([]),
    proveedorId
      ? prisma.licitacion.findMany({
          where: {
            eliminado: false,
            modoLicitacion: { not: "Manual" },
            estado: "En Proceso",
            proveedoresInvitados: { some: { proveedorId } },
          },
          orderBy: { fechaEjecucion: "asc" },
          select: {
            id: true,
            numero: true,
            jerarquia: true,
            fechaCreacion: true,
            fechaEjecucion: true,
            fechaFinRangoEntrega: true,
            instrucciones: true,
            rondaActual: true,
            maxRondas: true,
            inicioRondaActual: true,
            duracionRondaMinutos: true,
            esperandoDecision: true,
            _count: { select: { proveedoresInvitados: true } },
          },
        })
      : Promise.resolve([]),
    proveedorId
      ? prisma.licitacion.findMany({
          where: {
            eliminado: false,
            modoLicitacion: { not: "Manual" },
            estado: { in: ["Cerrada", "Finalizada"] },
            proveedoresInvitados: { some: { proveedorId } },
          },
          orderBy: { fechaEjecucion: "desc" },
          select: {
            id: true,
            numero: true,
            jerarquia: true,
            fechaEjecucion: true,
            estado: true,
            asignaciones: {
              select: { proveedorId: true, estatusProveedor: true, fechaLimiteConfirmacion: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Fetch OfertaItems to determine "cotizó" badge per En Proceso row
  const enProcesoIds = enProcesoRaw.map((l: any) => l.id);
  const ofertasActuales =
    proveedorId && enProcesoIds.length > 0
      ? await prisma.ofertaItem.findMany({
          where: {
            proveedorId,
            licitacionItem: { licitacionId: { in: enProcesoIds } },
          },
          select: {
            ronda: true,
            licitacionItem: { select: { licitacionId: true } },
          },
        })
      : [];

  const ofertaSet = new Set(
    ofertasActuales.map((o: any) => `${o.licitacionItem.licitacionId}:${o.ronda}`)
  );

  const programadas: LicitacionProgramada[] = programadasRaw.map((l: any) => ({
    id: l.id,
    numero: l.numero,
    jerarquia: l.jerarquia,
    fechaCreacion: l.fechaCreacion.toISOString(),
    fechaEjecucion: l.fechaEjecucion?.toISOString() ?? null,
    fechaFinRangoEntrega: l.fechaFinRangoEntrega?.toISOString() ?? null,
    totalParticipantes: l._count.proveedoresInvitados,
    instrucciones: l.instrucciones,
  }));

  const enProceso: LicitacionEnProceso[] = enProcesoRaw.map((l: any) => {
    let rondaFinMs: number | null = null;
    if (l.rondaActual > 0 && !l.esperandoDecision && l.inicioRondaActual) {
      rondaFinMs = l.inicioRondaActual.getTime() + l.duracionRondaMinutos * 60 * 1000;
    }
    return {
      id: l.id,
      numero: l.numero,
      jerarquia: l.jerarquia,
      fechaCreacion: l.fechaCreacion.toISOString(),
      fechaEjecucion: l.fechaEjecucion?.toISOString() ?? null,
      fechaFinRangoEntrega: l.fechaFinRangoEntrega?.toISOString() ?? null,
      totalParticipantes: l._count.proveedoresInvitados,
      instrucciones: l.instrucciones,
      rondaActual: l.rondaActual,
      maxRondas: l.maxRondas,
      rondaFinMs,
      esperandoDecision: l.esperandoDecision,
      cotizóEnRondaActual: ofertaSet.has(`${l.id}:${l.rondaActual}`),
    };
  });

  const finalizadas: LicitacionFinalizada[] = finalizadasRaw.map((l: any) => {
    const { subEstado, confirmacionDeadlineMs } = getSubEstadoYDeadline(l.asignaciones, proveedorId);
    return {
      id: l.id,
      numero: l.numero,
      jerarquia: l.jerarquia,
      fechaEjecucion: l.fechaEjecucion?.toISOString() ?? null,
      estado: l.estado,
      subEstado,
      confirmacionDeadlineMs,
    };
  });

  return (
    <div className="max-w-6xl space-y-6">
      <PageTitle title="Mis Licitaciones" />
      <MisLicitacionesTabla
        programadas={programadas}
        enProceso={enProceso}
        finalizadas={finalizadas}
        basePath={basePath}
      />
    </div>
  );
}
