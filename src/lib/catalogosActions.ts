"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type CatalogoValorInput = {
  codigo: string;
  nombre: string;
  simbolo?: string | null;
  activo?: boolean;
  orden?: number;
};

export async function crearCatalogoValorAction(
  tipo: string,
  clienteId: string,
  datos: CatalogoValorInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.catalogoValor.create({
      data: {
        tipo,
        clienteId,
        codigo: datos.codigo.toUpperCase().trim(),
        nombre: datos.nombre.trim(),
        simbolo: datos.simbolo?.trim() || null,
        activo: datos.activo ?? true,
        orden: datos.orden ?? 0,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un valor con ese código." };
    return { ok: false, error: "Error al crear el valor." };
  }
}

export async function actualizarCatalogoValorAction(
  id: string,
  datos: Partial<CatalogoValorInput>
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.catalogoValor.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
        ...(datos.simbolo !== undefined ? { simbolo: datos.simbolo?.trim() || null } : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
        ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un valor con ese código." };
    return { ok: false, error: "Error al actualizar." };
  }
}

export async function eliminarCatalogoValorAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const valor: any = await db.catalogoValor.findUnique({ where: { id } });
  if (!valor) return { ok: false, error: "No encontrado." };

  let count = 0;
  try {
    if (valor.tipo === "JERARQUIA") {
      count = await prisma.licitacion.count({ where: { jerarquia: valor.nombre, eliminado: false } });
    } else if (valor.tipo === "TIPO_LICITACION") {
      count = await prisma.licitacion.count({ where: { tipoLicitacion: valor.nombre, eliminado: false } });
    } else if (valor.tipo === "FAMILIA") {
      count = await prisma.producto.count({ where: { familia: valor.nombre, eliminado: false } });
    } else if (valor.tipo === "UNIDAD_MEDIDA") {
      count = await prisma.producto.count({ where: { unidadMedida: valor.nombre, eliminado: false } });
    } else if (valor.tipo === "MONEDA") {
      count = await prisma.licitacionItem.count({ where: { moneda: valor.codigo } });
    }
  } catch {
    // Ignore count errors — proceed with deletion if usage check fails
  }

  if (count > 0) {
    return {
      ok: false,
      error: `No se puede eliminar, está en uso en ${count} registro${count !== 1 ? "s" : ""}. Desactívalo en su lugar.`,
    };
  }

  await db.catalogoValor.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleActivoCatalogoValorAction(
  id: string,
  activo: boolean
): Promise<{ ok: boolean }> {
  await db.catalogoValor.update({ where: { id }, data: { activo } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actualizarOrdenAction(id: string, orden: number): Promise<{ ok: boolean }> {
  await db.catalogoValor.update({ where: { id }, data: { orden } });
  revalidatePath("/", "layout");
  return { ok: true };
}
