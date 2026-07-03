"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { crearOrdenesCompraParaLicitacion } from "./ordenesUtils";

export type FilaAsignacion = {
  licitacionItemId: string;
  proveedorId: string;
  cantidadAsignada: number;
  precioUnitario: number;
  moneda: string;
  ronda: number;
  orden: number;
  fechaObjetivo: string | null;
  fechaEstimadaProveedor: string | null;
};

function revalidar(basePath: string, licitacionId: string) {
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores/${licitacionId}`);
}

export async function confirmarAsignacionesAction(
  licitacionId: string,
  filas: FilaAsignacion[],
  tiempoConfirmacionHoras: number,
  basePath: string
): Promise<void> {
  const fechaLimiteConfirmacion = new Date(
    Date.now() + tiempoConfirmacionHoras * 60 * 60 * 1000
  );

  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).asignacionMaterial.createMany({
      data: filas.map((f) => ({
        licitacionId,
        licitacionItemId: f.licitacionItemId,
        proveedorId: f.proveedorId,
        cantidadAsignada: f.cantidadAsignada,
        precioUnitario: f.precioUnitario,
        moneda: f.moneda,
        ronda: f.ronda,
        orden: f.orden,
        estatusProveedor: "Pendiente",
        fechaObjetivo: f.fechaObjetivo ? new Date(f.fechaObjetivo) : null,
        fechaEstimadaProveedor: f.fechaEstimadaProveedor
          ? new Date(f.fechaEstimadaProveedor)
          : null,
        fechaLimiteConfirmacion,
      })),
    }),
    prisma.licitacion.update({
      where: { id: licitacionId },
      data: { estado: "Finalizada", fechaFinalizada: new Date() },
    }),
  ]);

  // OC no se crea aquí: estatus sigue "Pendiente". Se crea al confirmar/forzar cierre.

  revalidar(basePath, licitacionId);
}

export async function finalizarSinEsperarAction(
  licitacionId: string,
  filas: FilaAsignacion[],
  basePath: string
): Promise<void> {
  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).asignacionMaterial.createMany({
      data: filas.map((f) => ({
        licitacionId,
        licitacionItemId: f.licitacionItemId,
        proveedorId: f.proveedorId,
        cantidadAsignada: f.cantidadAsignada,
        precioUnitario: f.precioUnitario,
        moneda: f.moneda,
        ronda: f.ronda,
        orden: f.orden,
        estatusProveedor: "Aprobado",
        fechaObjetivo: f.fechaObjetivo ? new Date(f.fechaObjetivo) : null,
        fechaEstimadaProveedor: f.fechaEstimadaProveedor
          ? new Date(f.fechaEstimadaProveedor)
          : null,
        fechaLimiteConfirmacion: null,
      })),
    }),
    prisma.licitacion.update({
      where: { id: licitacionId },
      data: { estado: "Finalizada", fechaFinalizada: new Date() },
    }),
  ]);

  await crearOrdenesCompraParaLicitacion(licitacionId);

  revalidar(basePath, licitacionId);
}

export async function reasignarProveedorAction(
  asignacionId: string,
  proveedorId: string,
  precioUnitario: number,
  ronda: number,
  fechaEstimadaProveedor: string | null,
  tiempoConfirmacionHoras: number,
  licitacionId: string,
  basePath: string
): Promise<void> {
  const fechaLimiteConfirmacion = new Date(
    Date.now() + tiempoConfirmacionHoras * 60 * 60 * 1000
  );

  await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      proveedorId,
      precioUnitario,
      ronda,
      fechaEstimadaProveedor: fechaEstimadaProveedor
        ? new Date(fechaEstimadaProveedor)
        : null,
      estatusProveedor: "Pendiente",
      fechaLimiteConfirmacion,
      fechaConfirmacion: null,
      motivoRechazo: null,
    },
  });

  revalidar(basePath, licitacionId);
}

export async function forzarCierreSeleccionAction(
  licitacionId: string,
  basePath: string
): Promise<void> {
  await prisma.asignacionMaterial.updateMany({
    where: { licitacionId, estatusProveedor: "Pendiente" },
    data: { estatusProveedor: "Aprobado" },
  });

  await crearOrdenesCompraParaLicitacion(licitacionId);

  revalidar(basePath, licitacionId);
}
