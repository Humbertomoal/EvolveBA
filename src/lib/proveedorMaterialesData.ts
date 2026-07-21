/**
 * Consultas a la BD para materiales/familias de proveedor. Este archivo
 * importa Prisma — NUNCA debe importarse desde un Client Component (solo
 * desde Server Components, Server Actions o Route Handlers). La lógica pura
 * de filtrado en memoria vive en proveedorMateriales.ts, que sí es seguro
 * de importar desde el cliente.
 */
import { prisma } from "@/src/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function sincronizarMaterialesDB(
  proveedorId: string,
  productoIds: string[],
  familias: string[] = []
): Promise<void> {
  const existentes = await prisma.proveedorMaterial.findMany({
    where: { proveedorId },
    select: { id: true, productoId: true },
  });

  const existentesIds = existentes.map((e) => e.productoId);
  const nuevosIds = productoIds.filter((id) => !existentesIds.includes(id));
  const aEliminar = existentes
    .filter((e) => !productoIds.includes(e.productoId))
    .map((e) => e.id);

  await prisma.$transaction([
    prisma.proveedorMaterial.deleteMany({ where: { id: { in: aEliminar } } }),
    ...nuevosIds.map((productoId) =>
      prisma.proveedorMaterial.create({
        data: { proveedorId, productoId },
        select: { id: true },
      })
    ),
  ]);

  // Legado: sigue estampando familias en las filas de ProveedorMaterial que
  // existan, para no romper lectores viejos. Solo funciona si ya hay al
  // menos un material — por eso NO es la fuente de verdad (ver abajo).
  await prisma.proveedorMaterial.updateMany({
    where: { proveedorId },
    data: { familias: familias.length > 0 ? JSON.stringify(familias) : null },
  });

  // Fuente de verdad: columna independiente en Proveedor, que persiste la
  // asignación de familias aunque el proveedor aún no tenga NINGÚN
  // ProveedorMaterial (el caso que rompía el guardado antes de este fix).
  try {
    await db.proveedor.update({
      where: { id: proveedorId },
      data: { familiasAsignadas: familias.length > 0 ? JSON.stringify(familias) : null },
    });
  } catch {
    // Migración pendiente — la columna familiasAsignadas aún no existe en la BD.
  }
}

export async function getMaterialesProveedor(
  proveedorId: string
): Promise<string[]> {
  const rows = await prisma.proveedorMaterial.findMany({
    where: { proveedorId },
    select: { productoId: true },
  });
  return rows.map((r) => r.productoId);
}

export async function getMapaProveedorMateriales(): Promise<
  Record<string, string[]>
> {
  const rows = await prisma.proveedorMaterial.findMany({
    select: { proveedorId: true, productoId: true },
  });
  return rows.reduce(
    (acc, r) => {
      if (!acc[r.proveedorId]) acc[r.proveedorId] = [];
      acc[r.proveedorId].push(r.productoId);
      return acc;
    },
    {} as Record<string, string[]>
  );
}

function parsearFamilias(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Familias asignadas a un proveedor, leídas de ProveedorMaterial — dato
 * legado, solo existe si el proveedor ya tiene al menos un material
 * seleccionado. Se mantiene como fallback de compatibilidad; usa
 * getFamiliasAsignadasProveedor() como fuente principal.
 */
export async function getFamiliasProveedor(proveedorId: string): Promise<string[]> {
  const row = await prisma.proveedorMaterial.findFirst({
    where: { proveedorId },
    select: { familias: true },
  });
  return parsearFamilias(row?.familias);
}

/**
 * Familias asignadas a un proveedor — lee primero Proveedor.familiasAsignadas
 * (fuente de verdad, funciona con o sin materiales seleccionados); si esa
 * columna todavía no existe (migración pendiente) o viene vacía, cae al dato
 * legado en ProveedorMaterial.familias.
 */
export async function getFamiliasAsignadasProveedor(
  proveedorId: string
): Promise<string[]> {
  try {
    const row = await db.proveedor.findUnique({
      where: { id: proveedorId },
      select: { familiasAsignadas: true },
    });
    const familias = parsearFamilias(row?.familiasAsignadas);
    if (familias.length > 0) return familias;
  } catch {
    // Migración pendiente — cae al fallback legado abajo.
  }
  return getFamiliasProveedor(proveedorId);
}

/** Mapa proveedorId → familias asignadas, para listas (evita N+1 consultas). */
export async function getMapaFamiliasAsignadasProveedores(): Promise<
  Record<string, string[]>
> {
  const mapa: Record<string, string[]> = {};

  try {
    const rows = await db.proveedor.findMany({
      where: { familiasAsignadas: { not: null } },
      select: { id: true, familiasAsignadas: true },
    });
    for (const r of rows) {
      const familias = parsearFamilias(r.familiasAsignadas);
      if (familias.length > 0) mapa[r.id] = familias;
    }
  } catch {
    // Migración pendiente — familiasAsignadas aún no existe en la BD.
  }

  // Fallback legado para proveedores que solo tienen familias guardadas en
  // ProveedorMaterial (datos de antes de este fix).
  const rowsLegado = await prisma.proveedorMaterial.findMany({
    where: { familias: { not: null } },
    select: { proveedorId: true, familias: true },
  });
  for (const r of rowsLegado) {
    if (mapa[r.proveedorId]) continue;
    const familias = parsearFamilias(r.familias);
    if (familias.length > 0) mapa[r.proveedorId] = familias;
  }

  return mapa;
}
