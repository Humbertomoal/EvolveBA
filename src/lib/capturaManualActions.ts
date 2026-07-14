"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";

export type OfertaManual = {
  licitacionItemId: string;
  proveedorId: string;
  precioUnitario: number;
  cantidadDisponible: number;
  fechaEstimadaEntrega: string | null;
};

export type FechaRequeridaManual = {
  licitacionItemId: string;
  fechaEntrega: string | null;
};

async function upsertOfertas(ofertas: OfertaManual[]) {
  for (const o of ofertas) {
    if (o.precioUnitario <= 0 && o.cantidadDisponible <= 0) continue;
    const fechaEstimadaEntrega = o.fechaEstimadaEntrega
      ? new Date(o.fechaEstimadaEntrega)
      : null;
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
        fechaEstimadaEntrega,
      },
      update: {
        precioUnitario: o.precioUnitario,
        cantidadDisponible: o.cantidadDisponible,
        fechaEstimadaEntrega,
      },
    });
  }
}

async function actualizarFechasRequeridas(fechas: FechaRequeridaManual[]) {
  for (const f of fechas) {
    await prisma.licitacionItem.update({
      where: { id: f.licitacionItemId },
      data: { fechaEntrega: f.fechaEntrega ? new Date(f.fechaEntrega) : null },
    });
  }
}

export async function guardarAvanceCapturaAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  fechasRequeridas: FechaRequeridaManual[],
  basePath: string
): Promise<void> {
  await Promise.all([upsertOfertas(ofertas), actualizarFechasRequeridas(fechasRequeridas)]);
  revalidatePath(
    `${basePath}/comprador/licitaciones-proceso/${licitacionId}/captura-manual`
  );
}

export async function finalizarCapturaManualAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  fechasRequeridas: FechaRequeridaManual[],
  basePath: string
): Promise<void> {
  await Promise.all([upsertOfertas(ofertas), actualizarFechasRequeridas(fechasRequeridas)]);
  await prisma.licitacion.update({
    where: { id: licitacionId },
    data: { estado: "Cerrada", fechaCerrada: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
