"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProductoInput } from "@/src/data/productos";
import {
  actualizarProducto,
  crearProducto,
  ErrorCrearProducto,
  generarCodigoProductoUnico,
} from "@/src/lib/productos";
import { prisma } from "@/src/lib/prisma";
import {
  exigirCompradorSesion,
  getCompradorSesionSegura,
} from "@/src/lib/compradorSessionSegura";
import type {
  ProductoBaseOpcion,
  ResultadoCrearProducto,
} from "@/src/lib/productoBaseTypes";

function extraerDatos(formData: FormData): ProductoInput {
  const familia = String(formData.get("familia") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const especificacionesTecnicas = String(
    formData.get("especificacionesTecnicas") ?? ""
  ).trim();
  const imagenUrl = String(formData.get("imagenUrl") ?? "").trim();
  const archivosEspecificaciones = String(
    formData.get("archivosEspecificaciones") ?? ""
  ).trim();

  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    tipoItem: formData.get("tipoItem") === "Servicio" ? "Servicio" : "Producto",
    familia: familia || undefined,
    unidadMedida: String(formData.get("unidadMedida") ?? "").trim(),
    codigo: String(formData.get("codigo") ?? "").trim(),
    descripcion: descripcion || undefined,
    imagenUrl: imagenUrl || undefined,
    especificacionesTecnicas: especificacionesTecnicas || undefined,
    archivosEspecificaciones:
      archivosEspecificaciones && archivosEspecificaciones !== "[]"
        ? archivosEspecificaciones
        : undefined,
    monedaPredeterminada: String(formData.get("monedaPredeterminada") ?? "").trim() || "MXN",
    codigoManual: formData.get("codigoManual") === "true",
  };
}

/** Genera el siguiente código disponible para familia+nombre. "" si falta el nombre. */
export async function generarCodigoProductoAction(
  familia: string,
  nombre: string,
  excludeId?: string
): Promise<string> {
  return generarCodigoProductoUnico(familia || undefined, nombre, excludeId);
}

/**
 * Buscador de "Partir de un material existente…" en ProductoForm. Nombre o
 * código, sin distinguir mayúsculas, sin eliminados, a lo más LIMITE_BUSQUEDA
 * resultados con solo los campos que pinta el desplegable. Sin texto devuelve
 * los primeros por nombre, para poder hojear.
 */
const LIMITE_BUSQUEDA = 20;

export async function buscarProductosBaseAction(
  q: string
): Promise<ProductoBaseOpcion[]> {
  if (!(await getCompradorSesionSegura())) return [];

  const texto = q.trim();
  return prisma.producto.findMany({
    where: {
      eliminado: false,
      ...(texto
        ? {
            OR: [
              { nombre: { contains: texto, mode: "insensitive" } },
              { codigo: { contains: texto, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, codigo: true, nombre: true, familia: true },
    orderBy: { nombre: "asc" },
    take: LIMITE_BUSQUEDA,
  });
}

/**
 * Crea un producto. Si el formulario trae `baseId` ("duplicar como base"),
 * crearProducto copia además los archivos heredados y los proveedores del base.
 *
 * Los fallos esperados se DEVUELVEN (no se lanzan) para que su mensaje llegue
 * al usuario: en producción Next oculta el texto de los errores lanzados desde
 * una server action. En éxito redirige al catálogo.
 */
export async function crearProductoAction(
  basePath: string,
  formData: FormData
): Promise<ResultadoCrearProducto | void> {
  const baseId = String(formData.get("baseId") ?? "").trim() || undefined;
  // Duplicar escribe en Storage y copia relaciones de proveedores: exige una
  // sesión interna. (El alta en blanco conserva el comportamiento de siempre.)
  if (baseId) await exigirCompradorSesion();

  try {
    await crearProducto(extraerDatos(formData), baseId);
  } catch (error) {
    if (error instanceof ErrorCrearProducto) {
      return { ok: false, codigo: error.codigo, error: error.message };
    }
    throw error;
  }
  revalidatePath(`${basePath}/comprador/catalogo`);
  redirect(`${basePath}/comprador/catalogo`);
}

export async function actualizarProductoAction(
  id: string,
  basePath: string,
  formData: FormData
) {
  await actualizarProducto(id, extraerDatos(formData));
  revalidatePath(`${basePath}/comprador/catalogo`);
  redirect(`${basePath}/comprador/catalogo`);
}

/** Returns true if the code is available (not already used by another product). */
export async function verificarCodigoDisponibleAction(
  codigo: string,
  excludeId?: string
): Promise<boolean> {
  if (!codigo.trim()) return true;
  const existing = await prisma.producto.findFirst({
    where: {
      codigo,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

export async function toggleActivoProductoAction(
  id: string,
  activo: boolean,
  basePath: string
): Promise<void> {
  await prisma.producto.update({ where: { id }, data: { activo } });
  revalidatePath(`${basePath}/comprador/catalogo`);
}

export type UsoProducto = {
  enUso: boolean;
  licitaciones: number;
  proveedores: number;
};

/** Reports whether a product is referenced by any licitación item or provider catalog. */
export async function getProductoUsoAction(id: string): Promise<UsoProducto> {
  const [licitacionItems, proveedores] = await Promise.all([
    prisma.licitacionItem.findMany({
      where: { productoId: id },
      select: { licitacionId: true },
      distinct: ["licitacionId"],
    }),
    prisma.proveedorMaterial.count({ where: { productoId: id } }),
  ]);
  const licitaciones = licitacionItems.length;
  return { enUso: licitaciones > 0 || proveedores > 0, licitaciones, proveedores };
}

/**
 * Soft-deletes a product. Re-validates usage server-side (in case it changed
 * since the client last checked) and refuses to delete a product in use.
 */
export async function eliminarProductoAction(
  id: string,
  basePath: string
): Promise<{ ok: boolean } & UsoProducto> {
  const uso = await getProductoUsoAction(id);
  if (uso.enUso) return { ok: false, ...uso };

  await prisma.producto.update({
    where: { id },
    data: { eliminado: true, eliminadoEn: new Date() },
  });
  revalidatePath(`${basePath}/comprador/catalogo`);
  return { ok: true, ...uso };
}
