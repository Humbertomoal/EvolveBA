"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  exigirProveedorSesion,
  getIdentidadActual,
} from "@/src/lib/proveedorSessionSegura";
import {
  sincronizarMaterialesDB,
  getMaterialesProveedor,
  getMapaProveedorMateriales,
  getFamiliasProveedor,
  getFamiliasAsignadasProveedor,
  getMapaFamiliasAsignadasProveedores,
} from "@/src/lib/proveedorMaterialesData";

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

// ── Acciones DEL PROVEEDOR sobre su propio catálogo ─────────────────────────
//
// Ninguna recibe ya `proveedorId`: lo resuelven desde la sesión. Antes venía del
// cliente, así que cualquiera podía invocarlas con el id de un competidor y
// reescribirle el catálogo.

export async function sincronizarMaterialesAction(
  productoIds: string[],
  basePath?: string,
  familias: string[] = []
): Promise<void> {
  const { proveedorId } = await exigirProveedorSesion();
  await sincronizarMaterialesDB(proveedorId, productoIds, familias);
  // El proveedor guardó su selección de materiales: esto cuenta como
  // confirmación de su catálogo, aunque no haya cambiado nada.
  await marcarCatalogoValidadoSeguro(proveedorId, true, "proveedor");
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

export async function agregarMaterialProveedorAction(
  productoId: string,
  basePath?: string
): Promise<void> {
  const { proveedorId } = await exigirProveedorSesion();
  await prisma.proveedorMaterial.upsert({
    where: { proveedorId_productoId: { proveedorId, productoId } },
    create: { proveedorId, productoId },
    update: {},
    select: { id: true },
  });
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

export async function quitarMaterialProveedorAction(
  productoId: string,
  basePath?: string
): Promise<void> {
  const { proveedorId } = await exigirProveedorSesion();
  await prisma.proveedorMaterial.deleteMany({
    where: { proveedorId, productoId },
  });
  if (basePath) revalidatePath(`${basePath}/proveedor/catalogo`);
}

// ── Acción DEL COMPRADOR ────────────────────────────────────────────────────
//
// OJO: esta NO es una acción de proveedor, aunque viva en este archivo. La
// invoca el comprador desde CatalogoValidadoSection para dar por bueno el
// catálogo de un tercero (`validadoPor: "comprador"`), así que SÍ debe recibir
// el proveedorId: forzarlo a la sesión rompería el flujo del comprador.
// Lo que se agrega es la comprobación de que quien llama NO es un proveedor —
// si no, un proveedor podría auto-validarse o validar a otro.
export async function marcarCatalogoValidadoAction(
  proveedorId: string,
  validado: boolean,
  basePath?: string
): Promise<void> {
  const identidad = await getIdentidadActual();
  if (!identidad) {
    throw new Error("No autorizado: se requiere sesión.");
  }
  if (identidad.esProveedor) {
    throw new Error("No autorizado: solo un comprador puede validar catálogos.");
  }

  await marcarCatalogoValidadoSeguro(proveedorId, validado, "comprador");
  if (basePath) {
    revalidatePath(`${basePath}/comprador/proveedores/${proveedorId}/editar`);
    revalidatePath(`${basePath}/comprador/proveedores`);
  }
}
