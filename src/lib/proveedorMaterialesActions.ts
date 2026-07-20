"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  sincronizarMaterialesDB,
  getMaterialesProveedor,
  getMapaProveedorMateriales,
  getFamiliasProveedor,
  getFamiliasAsignadasProveedor,
  getMapaFamiliasAsignadasProveedores,
} from "@/src/lib/proveedorMateriales";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export {
  getMaterialesProveedor,
  getMapaProveedorMateriales,
  getFamiliasProveedor,
  getFamiliasAsignadasProveedor,
  getMapaFamiliasAsignadasProveedores,
};

// Migración pendiente — las columnas catalogoValidado* aún no existen en la
// BD hasta que se corra la migración; se ignoran silenciosamente si fallan.
async function marcarCatalogoValidadoSeguro(
  proveedorId: string,
  validado: boolean,
  validadoPor: "proveedor" | "comprador"
): Promise<void> {
  try {
    await db.proveedor.update({
      where: { id: proveedorId },
      data: {
        catalogoValidado: validado,
        catalogoValidadoEn: validado ? new Date() : null,
        catalogoValidadoPor: validado ? validadoPor : null,
      },
    });
  } catch {
    // Columna aún no migrada — no-op.
  }
}

export async function sincronizarMaterialesAction(
  proveedorId: string,
  productoIds: string[],
  basePath?: string,
  familias: string[] = []
): Promise<void> {
  await sincronizarMaterialesDB(proveedorId, productoIds, familias);
  // El proveedor guardó su selección de materiales: esto cuenta como
  // confirmación de su catálogo, aunque no haya cambiado nada.
  await marcarCatalogoValidadoSeguro(proveedorId, true, "proveedor");
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

export async function marcarCatalogoValidadoAction(
  proveedorId: string,
  validado: boolean,
  basePath?: string
): Promise<void> {
  await marcarCatalogoValidadoSeguro(proveedorId, validado, "comprador");
  if (basePath) {
    revalidatePath(`${basePath}/comprador/proveedores/${proveedorId}/editar`);
    revalidatePath(`${basePath}/comprador/proveedores`);
  }
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
