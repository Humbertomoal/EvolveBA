"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  registrarCambioEstado,
  getUsuarioIdActual,
  ESTADO_ESPERANDO_DECISION,
} from "@/src/lib/estadoLog";

// Fuerza el fin de la ronda actual:
// - Si es ronda intermedia: avanza a la siguiente
// - Si es la última ronda: activa esperandoDecision
export async function forzarAvanceRondaAction(
  id: string,
  basePath: string
): Promise<void> {
  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { rondaActual: true, maxRondas: true },
  });
  if (!lic) return;

  const now = new Date();
  if (lic.rondaActual < lic.maxRondas) {
    // Solo avanza de ronda: el estado sigue "En Proceso" (no se registra).
    await prisma.licitacion.update({
      where: { id },
      data: { rondaActual: lic.rondaActual + 1, inicioRondaActual: now },
    });
  } else {
    await prisma.licitacion.update({
      where: { id },
      data: { esperandoDecision: true, fechaFinReal: now, fechaEsperandoDecision: now },
    });
    await registrarCambioEstado(
      id,
      "En Proceso",
      ESTADO_ESPERANDO_DECISION,
      await getUsuarioIdActual()
    );
  }

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

// Agrega una ronda extra: incrementa rondaActual y maxRondas en 1,
// reinicia inicioRondaActual y limpia esperandoDecision.
// Se incrementa maxRondas (no solo rondaActual) para que la lógica de
// verificarYActualizarEstado siga funcionando correctamente:
// cuando esta ronda extra termine, rondaActual == maxRondas → esperandoDecision=true.
export async function agregarRondaExtraAction(
  id: string,
  basePath: string
): Promise<void> {
  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { rondaActual: true, maxRondas: true, esperandoDecision: true },
  });
  if (!lic) return;

  await prisma.licitacion.update({
    where: { id },
    data: {
      rondaActual: lic.rondaActual + 1,
      maxRondas: lic.maxRondas + 1,
      inicioRondaActual: new Date(),
      esperandoDecision: false,
    },
  });

  // Reabre las rondas: si venía de "Esperando Decisión", vuelve a "En Proceso".
  if (lic.esperandoDecision) {
    await registrarCambioEstado(
      id,
      ESTADO_ESPERANDO_DECISION,
      "En Proceso",
      await getUsuarioIdActual()
    );
  }

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

export async function cerrarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  // Lee el estado previo para encadenar bien la bitácora (En Proceso o el
  // pseudo-estado "Esperando Decisión" según el flag).
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, esperandoDecision: true },
  });

  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cerrada", esperandoDecision: false, fechaCerrada: new Date() },
  });

  const estadoAnterior = anterior?.esperandoDecision
    ? ESTADO_ESPERANDO_DECISION
    : anterior?.estado ?? null;
  await registrarCambioEstado(id, estadoAnterior, "Cerrada", await getUsuarioIdActual());

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

export async function cancelarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, esperandoDecision: true },
  });

  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cancelada", esperandoDecision: false, fechaCancelada: new Date() },
  });

  const estadoAnterior = anterior?.esperandoDecision
    ? ESTADO_ESPERANDO_DECISION
    : anterior?.estado ?? null;
  await registrarCambioEstado(id, estadoAnterior, "Cancelada", await getUsuarioIdActual());

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
