"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";

export type OfertaManual = {
  licitacionItemId: string;
  proveedorId: string;
  precioUnitario: number;
  cantidadDisponible: number;
};

async function upsertOfertas(ofertas: OfertaManual[]) {
  for (const o of ofertas) {
    if (o.precioUnitario <= 0 && o.cantidadDisponible <= 0) continue;
    await prisma.ofertaItem.upsert({
      where: {
        licitacionItemId_proveedorId_ronda: {
          licitacionItemId: o.licitacionItemId,
          proveedorId: o.proveedorId,
          ronda: 1,
        },
      },
      create: {
        licitacionItemId: o.licitacionItemId,
        proveedorId: o.proveedorId,
        ronda: 1,
        precioUnitario: o.precioUnitario,
        cantidadDisponible: o.cantidadDisponible,
        puedeCumplirFecha: true,
      },
      update: {
        precioUnitario: o.precioUnitario,
        cantidadDisponible: o.cantidadDisponible,
      },
    });
  }
}

export async function guardarAvanceCapturaAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  basePath: string
): Promise<void> {
  await upsertOfertas(ofertas);
  revalidatePath(
    `${basePath}/comprador/licitaciones-proceso/${licitacionId}/captura-manual`
  );
}

export async function finalizarCapturaManualAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  basePath: string
): Promise<void> {
  await upsertOfertas(ofertas);
  await prisma.licitacion.update({
    where: { id: licitacionId },
    data: { estado: "Cerrada", fechaCerrada: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
