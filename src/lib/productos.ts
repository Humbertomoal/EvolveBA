import { prisma } from "@/src/lib/prisma";
import type { Producto, ProductoInput } from "@/src/data/productos";
import {
  construirPrefijoCodigo,
  extraerConsecutivo,
  formatearConsecutivo,
} from "@/src/lib/generarCodigoProducto";
import { copiarArchivo, eliminarArchivo } from "@/src/lib/supabaseStorage";

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

/**
 * Material para "duplicar como base": igual que getProductoById pero excluye
 * los eliminados, que tampoco aparecen en el buscador.
 */
export async function getProductoBase(id: string): Promise<Producto | null> {
  const row = await prisma.producto.findFirst({
    where: { id, eliminado: false },
    select: PRODUCTO_SELECT,
  });
  if (!row) return null;
  const codigoManualMap = await obtenerCodigoManualMap([id]);
  return mapear(row, codigoManualMap[id] ?? false);
}

/** Cuántos proveedores surten un material (se copiarán al duplicarlo). */
export async function contarProveedoresDeProducto(productoId: string): Promise<number> {
  return prisma.proveedorMaterial.count({ where: { productoId } });
}

/**
 * Fallo esperado al crear un producto, con un mensaje apto para el usuario.
 * crearProductoAction lo convierte en un resultado en vez de relanzarlo: en
 * producción Next oculta el mensaje de los errores lanzados desde una server
 * action, y el usuario vería un "no se pudo guardar" genérico.
 */
export class ErrorCrearProducto extends Error {
  constructor(
    readonly codigo: "CODIGO_DUPLICADO" | "BASE_NO_ENCONTRADA" | "COPIA_ARCHIVOS",
    mensaje: string
  ) {
    super(mensaje);
    this.name = "ErrorCrearProducto";
  }
}

function parsearUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Copia en Storage los archivos que el material nuevo HEREDÓ del base, para que
 * cada material sea dueño de los suyos. Devuelve url original → url copia.
 *
 * Solo se copian URLs que de verdad pertenecen al base (leído de la BD, no del
 * formulario): el navegador no puede colar aquí la URL de otro material. Lo que
 * no sea heredado es un archivo que el usuario subió en este formulario y ya es
 * propio del material nuevo.
 *
 * Todo o nada: si una copia falla, se intenta retirar las que ya se hicieron y
 * se lanza. El material no se crea con fichas a medias.
 */
async function copiarArchivosHeredados(
  urlsFormulario: string[],
  urlsBase: Set<string>
): Promise<Map<string, string>> {
  const copias = new Map<string, string>();
  try {
    for (const url of urlsFormulario) {
      if (!urlsBase.has(url) || copias.has(url)) continue;
      copias.set(url, await copiarArchivo(url));
    }
  } catch (error) {
    await descartarCopias(copias);
    throw new ErrorCrearProducto(
      "COPIA_ARCHIVOS",
      `No se pudieron copiar los archivos del material base, así que no se guardó el material nuevo. ${
        error instanceof Error ? error.message : ""
      }`.trim()
    );
  }
  return copias;
}

async function descartarCopias(copias: Map<string, string>): Promise<void> {
  await Promise.all(
    [...copias.values()].map((url) => eliminarArchivo(url).catch(() => {}))
  );
}

/**
 * Crea un producto. Con `baseId` ("duplicar como base") además:
 *   · copia en Storage los archivos heredados del base y guarda las URLs nuevas;
 *   · copia sus proveedores (ProveedorMaterial) al material nuevo.
 * El material base SOLO se lee: nada de este flujo lo escribe.
 */
export async function crearProducto(
  datos: ProductoInput,
  baseId?: string
): Promise<Producto> {
  if (await codigoProductoExiste(datos.codigo)) {
    throw new ErrorCrearProducto(
      "CODIGO_DUPLICADO",
      "Este código ya está en uso por otro producto."
    );
  }

  let imagenUrl = datos.imagenUrl ?? null;
  let archivosEspecificaciones = datos.archivosEspecificaciones || null;
  let proveedoresBase: { proveedorId: string; familias: string | null }[] = [];
  let copias = new Map<string, string>();

  if (baseId) {
    const base = await prisma.producto.findFirst({
      where: { id: baseId, eliminado: false },
      select: {
        imagenUrl: true,
        archivosEspecificaciones: true,
        proveedores: { select: { proveedorId: true, familias: true } },
      },
    });
    if (!base) {
      throw new ErrorCrearProducto(
        "BASE_NO_ENCONTRADA",
        "El material base ya no existe. Recarga la página o empieza en blanco."
      );
    }
    proveedoresBase = base.proveedores;

    const urlsBase = new Set<string>([
      ...(base.imagenUrl ? [base.imagenUrl] : []),
      ...parsearUrls(base.archivosEspecificaciones),
    ]);
    const urlsArchivos = parsearUrls(archivosEspecificaciones);
    copias = await copiarArchivosHeredados(
      [...(imagenUrl ? [imagenUrl] : []), ...urlsArchivos],
      urlsBase
    );

    if (imagenUrl) imagenUrl = copias.get(imagenUrl) ?? imagenUrl;
    if (urlsArchivos.length > 0) {
      archivosEspecificaciones = JSON.stringify(
        urlsArchivos.map((u) => copias.get(u) ?? u)
      );
    }
  }

  let row: ProductoDB;
  try {
    // Producto + proveedores en una sola transacción: o queda el material con
    // todos sus proveedores heredados, o no queda nada.
    row = await prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          codigo: datos.codigo,
          nombre: datos.nombre,
          tipoItem: datos.tipoItem,
          familia: datos.familia ?? null,
          unidadMedida: datos.unidadMedida,
          descripcion: datos.descripcion ?? null,
          imagenUrl,
          especificacionesTecnicas: datos.especificacionesTecnicas || null,
          archivosEspecificaciones,
          monedaPredeterminada: datos.monedaPredeterminada || "MXN",
          clienteId: "default",
        },
        select: PRODUCTO_SELECT,
      });
      if (proveedoresBase.length > 0) {
        await tx.proveedorMaterial.createMany({
          data: proveedoresBase.map((p) => ({
            proveedorId: p.proveedorId,
            productoId: creado.id,
            familias: p.familias,
          })),
          skipDuplicates: true,
        });
      }
      return creado;
    });
  } catch (error) {
    // Las copias ya subidas no las referencia nadie: se retiran (best-effort).
    await descartarCopias(copias);
    throw error;
  }

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
