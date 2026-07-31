import { prisma } from "@/src/lib/prisma";
import { registrarCambioEstado, ESTADO_ESPERANDO_DECISION } from "@/src/lib/estadoLog";

export async function verificarYActualizarEstado(licitacionId: string): Promise<void> {
  const lic = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: {
      id: true,
      estado: true,
      fechaEjecucion: true,
      rondaActual: true,
      maxRondas: true,
      duracionRondaMinutos: true,
      inicioRondaActual: true,
      esperandoDecision: true,
    },
  });

  if (!lic) return;

  const now = new Date();

  // a) Programada → En Proceso cuando ya pasó fechaEjecucion
  if (
    lic.estado === "Programada" &&
    lic.fechaEjecucion &&
    lic.fechaEjecucion <= now
  ) {
    await prisma.licitacion.update({
      where: { id: licitacionId },
      data: { estado: "En Proceso", rondaActual: 1, inicioRondaActual: now, fechaInicioLicitacion: now },
    });
    // Transición automática (por tiempo): sin usuario.
    await registrarCambioEstado(licitacionId, "Programada", "En Proceso", null);
    return;
  }

  // b) En Proceso: verificar si el tiempo de la ronda actual se agotó
  if (lic.estado !== "En Proceso" || lic.esperandoDecision || !lic.inicioRondaActual) {
    return;
  }

  const rondaFinMs =
    lic.inicioRondaActual.getTime() + lic.duracionRondaMinutos * 60 * 1000;

  if (Date.now() < rondaFinMs) return; // Ronda todavía en curso

  if (lic.rondaActual < lic.maxRondas) {
    // Ronda intermedia: avanza automáticamente
    await prisma.licitacion.update({
      where: { id: licitacionId },
      data: { rondaActual: lic.rondaActual + 1, inicioRondaActual: now },
    });
  } else {
    // Última ronda terminó: esperar decisión del comprador
    await prisma.licitacion.update({
      where: { id: licitacionId },
      data: { esperandoDecision: true, fechaFinReal: now, fechaEsperandoDecision: now },
    });
    // Entra a la etapa "Esperando Decisión" (automática, sin usuario).
    await registrarCambioEstado(
      licitacionId,
      "En Proceso",
      ESTADO_ESPERANDO_DECISION,
      null
    );
  }
}
