"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  sincronizarMaterialesDB,
  getMaterialesProveedor,
  getMapaProveedorMateriales,
  getFamiliasProveedor,
} from "@/src/lib/proveedorMateriales";

export { getMaterialesProveedor, getMapaProveedorMateriales, getFamiliasProveedor };

export async function sincronizarMaterialesAction(
  proveedorId: string,
  productoIds: string[],
  basePath?: string,
  familias: string[] = []
): Promise<void> {
  await sincronizarMaterialesDB(proveedorId, productoIds, familias);
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

export async function agregarMaterialProveedorAction(
  proveedorId: string,
  productoId: string,
  basePath?: string
): Promise<void> {
  await prisma.proveedorMaterial.upsert({
    where: { proveedorId_productoId: { proveedorId, productoId } },
    create: { proveedorId, productoId },
    update: {},
    select: { id: true },
  });
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

export async function quitarMaterialProveedorAction(
  proveedorId: string,
  productoId: string,
  basePath?: string
): Promise<void> {
  await prisma.proveedorMaterial.deleteMany({
    where: { proveedorId, productoId },
  });
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}
