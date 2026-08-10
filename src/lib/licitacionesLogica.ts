import { prisma } from "@/src/lib/prisma";
import { registrarCambioEstado, ESTADO_ESPERANDO_DECISION } from "@/src/lib/estadoLog";

/**
 * Avanza el estado de una licitación según el reloj. NO hay cron: esto corre de
 * forma perezosa en cada carga de página, así que varias ejecuciones concurren
 * de rutina (dos pestañas, comprador y proveedor a la vez, o una carga contra
 * el botón de cierre manual).
 *
 * Por eso cada escritura es un compare-and-set: el estado leído viaja en el
 * WHERE del updateMany y Postgres lo resuelve como un único UPDATE condicional.
 * Solo la ejecución que de verdad escribió (`count === 1`) registra en bitácora.
 *
 * Con el `update` directo que había antes, dos ejecuciones simultáneas
 * aplicaban el cambio dos veces y dejaban entradas DUPLICADAS en
 * LicitacionEstadoLog — ya observadas en la licitación 0011, con
 * "Programada → En Proceso" registrado dos veces. Esa bitácora alimenta los
 * tiempos por etapa del Tablero, así que los duplicados falsean los KPIs.
 */
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
    const arranque = await prisma.licitacion.updateMany({
      where: { id: licitacionId, estado: "Programada" },
      data: { estado: "En Proceso", rondaActual: 1, inicioRondaActual: now, fechaInicioLicitacion: now },
    });
    // Transición automática (por tiempo): sin usuario. Solo registra quien escribió.
    if (arranque.count === 1) {
      await registrarCambioEstado(licitacionId, "Programada", "En Proceso", null);
    }
    return;
  }

  // b) En Proceso: verificar si el tiempo de la ronda actual se agotó
  if (lic.estado !== "En Proceso" || lic.esperandoDecision || !lic.inicioRondaActual) {
    return;
  }

  const rondaFinMs =
    lic.inicioRondaActual.getTime() + lic.duracionRondaMinutos * 60 * 1000;

  if (Date.now() < rondaFinMs) return; // Ronda todavía en curso

  // El estado leído va en el WHERE: si otra ejecución ya avanzó la ronda o
  // cerró las rondas (incluido el cierre manual de golpe), el WHERE no casa y
  // esta ejecución no hace nada.
  if (lic.rondaActual < lic.maxRondas) {
    // Ronda intermedia: avanza automáticamente. Sin bitácora (los avances
    // intermedios no se registran), pero el CAS evita el doble salto de ronda.
    await prisma.licitacion.updateMany({
      where: {
        id: licitacionId,
        estado: "En Proceso",
        esperandoDecision: false,
        rondaActual: lic.rondaActual,
      },
      data: { rondaActual: lic.rondaActual + 1, inicioRondaActual: now },
    });
  } else {
    // Última ronda terminó: esperar decisión del comprador
    const cierre = await prisma.licitacion.updateMany({
      where: {
        id: licitacionId,
        estado: "En Proceso",
        esperandoDecision: false,
        rondaActual: lic.rondaActual,
      },
      data: { esperandoDecision: true, fechaFinReal: now, fechaEsperandoDecision: now },
    });
    // Entra a la etapa "Esperando Decisión" (automática, sin usuario).
    if (cierre.count === 1) {
      await registrarCambioEstado(
        licitacionId,
        "En Proceso",
        ESTADO_ESPERANDO_DECISION,
        null
      );
    }
  }
}
