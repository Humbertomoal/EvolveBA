"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProductoInput } from "@/src/data/productos";
import { actualizarProducto, crearProducto } from "@/src/lib/productos";
import { prisma } from "@/src/lib/prisma";

function extraerDatos(formData: FormData): ProductoInput {
  const familia = String(formData.get("familia") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const especificacionesTecnicas = String(
    formData.get("especificacionesTecnicas") ?? ""
  ).trim();

  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    tipoItem: formData.get("tipoItem") === "Servicio" ? "Servicio" : "Producto",
    familia: familia || undefined,
    unidadMedida: String(formData.get("unidadMedida") ?? "").trim(),
    codigo: String(formData.get("codigo") ?? "").trim(),
    descripcion: descripcion || undefined,
    imagenUrl: undefined,
    especificacionesTecnicas: especificacionesTecnicas || undefined,
    monedaPredeterminada: String(formData.get("monedaPredeterminada") ?? "").trim() || "MXN",
  };
}

export async function crearProductoAction(
  basePath: string,
  formData: FormData
) {
  await crearProducto(extraerDatos(formData));
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
