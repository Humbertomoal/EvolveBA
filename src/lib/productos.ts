import { prisma } from "@/src/lib/prisma";
import type { Producto, ProductoInput } from "@/src/data/productos";
import {
  construirPrefijoCodigo,
  extraerConsecutivo,
  formatearConsecutivo,
} from "@/src/lib/generarCodigoProducto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type ProductoDB = {
  id: string;
  codigo: string;
  nombre: string;
  tipoItem: string;
  familia: string | null;
  unidadMedida: string;
  descripcion: string | null;
  imagenUrl: string | null;
  especificacionesTecnicas: string | null;
  archivosEspecificaciones: string | null;
  monedaPredeterminada: string | null;
  activo: boolean;
  createdAt: Date;
};

const PRODUCTO_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  tipoItem: true,
  familia: true,
  unidadMedida: true,
  descripcion: true,
  imagenUrl: true,
  especificacionesTecnicas: true,
  archivosEspecificaciones: true,
  monedaPredeterminada: true,
  activo: true,
  createdAt: true,
} as const;

function mapear(p: ProductoDB, codigoManual = false): Producto {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    tipoItem: p.tipoItem as Producto["tipoItem"],
    familia: p.familia ?? undefined,
    unidadMedida: p.unidadMedida,
    descripcion: p.descripcion ?? undefined,
    imagenUrl: p.imagenUrl ?? undefined,
    especificacionesTecnicas: p.especificacionesTecnicas ?? undefined,
    archivosEspecificaciones: p.archivosEspecificaciones ?? undefined,
    monedaPredeterminada: p.monedaPredeterminada ?? "MXN",
    codigoManual,
    activo: p.activo,
    createdAt: p.createdAt,
  };
}

/**
 * Lee codigoManual por separado con `db` (as any): la columna es nueva y
 * puede no existir todavía en la BD (migración pendiente). Si falla, se
 * asume false para todos.
 */
async function obtenerCodigoManualMap(ids: string[]): Promise<Record<string, boolean>> {
  if (ids.length === 0) return {};
  try {
    const rows = await db.producto.findMany({
      where: { id: { in: ids } },
      select: { id: true, codigoManual: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.fromEntries(rows.map((r: any) => [r.id, !!r.codigoManual]));
  } catch {
    return {};
  }
}

export async function getProductos(): Promise<Producto[]> {
  const rows = await prisma.producto.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: "asc" },
    select: PRODUCTO_SELECT,
  });
  const codigoManualMap = await obtenerCodigoManualMap(rows.map((r) => r.id));
  return rows.map((r) => mapear(r, codigoManualMap[r.id] ?? false));
}

export async function getProductoById(id: string): Promise<Producto | null> {
  const row = await prisma.producto.findUnique({ where: { id }, select: PRODUCTO_SELECT });
  if (!row) return null;
  const codigoManualMap = await obtenerCodigoManualMap([id]);
  return mapear(row, codigoManualMap[id] ?? false);
}

/** Escribe codigoManual aparte del create/update tipado — columna pendiente de migración. */
async function guardarCodigoManual(id: string, codigoManual: boolean): Promise<void> {
  try {
    await db.producto.update({ where: { id }, data: { codigoManual } });
  } catch {
    // Migración pendiente — la columna codigoManual aún no existe en la BD.
  }
}

export async function crearProducto(datos: ProductoInput): Promise<Producto> {
  if (await codigoProductoExiste(datos.codigo)) {
    throw new Error("CODIGO_DUPLICADO");
  }
  const row = await prisma.producto.create({
    data: {
      codigo: datos.codigo,
      nombre: datos.nombre,
      tipoItem: datos.tipoItem,
      familia: datos.familia ?? null,
      unidadMedida: datos.unidadMedida,
      descripcion: datos.descripcion ?? null,
      imagenUrl: datos.imagenUrl ?? null,
      especificacionesTecnicas: datos.especificacionesTecnicas || null,
      archivosEspecificaciones: datos.archivosEspecificaciones || null,
      monedaPredeterminada: datos.monedaPredeterminada || "MXN",
      clienteId: "default",
    },
    select: PRODUCTO_SELECT,
  });
  const codigoManual = datos.codigoManual ?? false;
  await guardarCodigoManual(row.id, codigoManual);
  return mapear(row, codigoManual);
}

export async function actualizarProducto(
  id: string,
  datos: ProductoInput
): Promise<Producto | null> {
  if (await codigoProductoExiste(datos.codigo, id)) {
    throw new Error("CODIGO_DUPLICADO");
  }
  try {
    const row = await prisma.producto.update({
      where: { id },
      data: {
        codigo: datos.codigo,
        nombre: datos.nombre,
        tipoItem: datos.tipoItem,
        familia: datos.familia ?? null,
        unidadMedida: datos.unidadMedida,
        descripcion: datos.descripcion ?? null,
        imagenUrl: datos.imagenUrl ?? null,
        especificacionesTecnicas: datos.especificacionesTecnicas || null,
        archivosEspecificaciones: datos.archivosEspecificaciones || null,
        monedaPredeterminada: datos.monedaPredeterminada || "MXN",
      },
      select: PRODUCTO_SELECT,
    });
    const codigoManual = datos.codigoManual ?? false;
    await guardarCodigoManual(row.id, codigoManual);
    return mapear(row, codigoManual);
  } catch {
    return null;
  }
}

/** true si el código ya está en uso por otro producto (cualquier estado, por el unique constraint). */
export async function codigoProductoExiste(
  codigo: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.producto.findFirst({
    where: {
      codigo,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Consecutivo por familia: máximo de los últimos 3 dígitos entre los códigos
 * de productos de esa familia, +1. Excluye excludeId (el propio producto al
 * editar) para no autoinflar el consecutivo con su propio código anterior.
 */
async function obtenerSiguienteConsecutivoFamilia(
  familia: string | null,
  excludeId?: string
): Promise<number> {
  const productos = await prisma.producto.findMany({
    where: {
      familia,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { codigo: true },
  });
  let max = 0;
  for (const p of productos) {
    const consecutivo = extraerConsecutivo(p.codigo);
    if (consecutivo !== null && consecutivo > max) max = consecutivo;
  }
  return max + 1;
}

/**
 * Genera un código único {INICIALES_FAMILIA}-{INICIALES_DESCRIPCION}-{NNN}
 * a partir de familia + nombre. "" si no hay suficientes datos (sin nombre).
 */
export async function generarCodigoProductoUnico(
  familia: string | undefined,
  nombre: string,
  excludeId?: string
): Promise<string> {
  const prefijo = construirPrefijoCodigo(familia ?? "", nombre);
  if (!prefijo) return "";

  let consecutivo = await obtenerSiguienteConsecutivoFamilia(familia || null, excludeId);
  let codigo = `${prefijo}-${formatearConsecutivo(consecutivo)}`;
  while (await codigoProductoExiste(codigo, excludeId)) {
    consecutivo += 1;
    codigo = `${prefijo}-${formatearConsecutivo(consecutivo)}`;
  }
  return codigo;
}
