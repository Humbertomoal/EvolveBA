"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";

type OfertaItemInput = {
  licitacionItemId: string;
  precioUnitario: number;
  cantidadDisponible: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
};

export async function enviarOfertaAction(
  licitacionId: string,
  proveedorId: string,
  ronda: number,
  basePath: string,
  items: OfertaItemInput[]
): Promise<void> {
  for (const item of items) {
    await prisma.ofertaItem.upsert({
      where: {
        licitacionItemId_proveedorId_ronda: {
          licitacionItemId: item.licitacionItemId,
          proveedorId,
          ronda,
        },
      },
      create: {
        licitacionItemId: item.licitacionItemId,
        proveedorId,
        ronda,
        precioUnitario: item.precioUnitario,
        cantidadDisponible: item.cantidadDisponible,
        puedeCumplirFecha: item.puedeCumplirFecha,
        fechaEstimadaEntrega: item.fechaEstimadaEntrega
          ? new Date(item.fechaEstimadaEntrega)
          : null,
      },
      update: {
        precioUnitario: item.precioUnitario,
        cantidadDisponible: item.cantidadDisponible,
        puedeCumplirFecha: item.puedeCumplirFecha,
        fechaEstimadaEntrega: item.fechaEstimadaEntrega
          ? new Date(item.fechaEstimadaEntrega)
          : null,
      },
    });
  }

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}`);
}
