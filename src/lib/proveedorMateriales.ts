/**
 * Helpers PUROS de materiales de proveedor — sin dependencias de Prisma/BD,
 * para poder importarse desde Client Components (p.ej. LicitacionForm.tsx)
 * sin arrastrar `pg`/`@prisma/adapter-pg` al bundle del navegador.
 *
 * Las consultas a la base de datos viven en proveedorMaterialesData.ts.
 */

/**
 * Filtra items (licitación, o cualquier lista con productoId) a los que
 * coinciden con el catálogo de un proveedor. Si el proveedor no tiene
 * materiales asignados, o ninguno coincide con la lista, se devuelven TODOS
 * los items sin filtrar — mismo comportamiento que ve el proveedor al entrar
 * a su detalle de licitación en el portal.
 */
export function filtrarItemsPorMaterialesProveedor<T extends { productoId: string }>(
  items: T[],
  materialesProveedorIds: string[]
): T[] {
  if (materialesProveedorIds.length === 0) return items;
  const coincidencias = items.filter((item) =>
    materialesProveedorIds.includes(item.productoId)
  );
  return coincidencias.length > 0 ? coincidencias : items;
}
