"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";

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
    await prisma.licitacion.update({
      where: { id },
      data: { rondaActual: lic.rondaActual + 1, inicioRondaActual: now },
    });
  } else {
    await prisma.licitacion.update({
      where: { id },
      data: { esperandoDecision: true, fechaFinReal: now, fechaEsperandoDecision: now },
    });
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
    select: { rondaActual: true, maxRondas: true },
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

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

export async function cerrarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cerrada", esperandoDecision: false, fechaCerrada: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

export async function cancelarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cancelada", esperandoDecision: false, fechaCancelada: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
