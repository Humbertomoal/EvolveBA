"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { crearOrdenesCompraParaLicitacion } from "./ordenesUtils";

export async function confirmarAsignacionProveedorAction(
  asignacionId: string,
  licitacionId: string,
  basePath: string
) {
  const updated = await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      estatusProveedor: "Confirmado",
      fechaConfirmacion: new Date(),
    },
    select: { proveedorId: true },
  });

  // Create OC if one doesn't exist yet for this proveedor+licitacion
  await crearOrdenesCompraParaLicitacion(licitacionId, updated.proveedorId);

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}/resultado`);
  revalidatePath(`${basePath}/proveedor/licitaciones`);
  revalidatePath(`${basePath}/proveedor/ordenes`);
}

export async function rechazarAsignacionProveedorAction(
  asignacionId: string,
  motivo: string,
  licitacionId: string,
  basePath: string
) {
  await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      estatusProveedor: "Rechazado",
      motivoRechazo: motivo,
    },
  });
  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}/resultado`);
  revalidatePath(`${basePath}/proveedor/licitaciones`);
}
