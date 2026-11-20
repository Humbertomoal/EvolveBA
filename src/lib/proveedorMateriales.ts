/**
 * Helpers PUROS de materiales de proveedor — sin dependencias de Prisma/BD,
 * para poder importarse desde Client Components (p.ej. LicitacionForm.tsx)
 * sin arrastrar `pg`/`@prisma/adapter-pg` al bundle del navegador.
 *
 * Las consultas a la base de datos viven en proveedorMaterialesData.ts.
 */

/**
 * Filtra items (licitación, o cualquier lista con productoId) a los que ve un
 * proveedor según su catálogo. Es la regla del portal, y la usan también el
 * correo de invitación y el formulario. Dos casos:
 *
 *   · Proveedor SIN catálogo (cero materiales): ve TODOS los items. Nunca lo
 *     configuró, así que mostrarle todo es razonable y lo empuja a hacerlo.
 *   · Proveedor CON catálogo: ve SOLO los que coinciden, aunque sean cero.
 *     Curó su lista, y una licitación que no toca nada de lo suyo no es suya.
 *
 * Antes había un tercer caso: con catálogo pero sin ninguna coincidencia veía
 * TODO, justo lo contrario de lo que el proveedor decidió (en la 0029, 10
 * proveedores con un solo producto ajeno veían las 244 partidas). Ver cero
 * ahora es posible: el formulario avisa al invitar a quien quedaría así
 * (`veNingunaPartida`).
 */
export function filtrarItemsPorMaterialesProveedor<T extends { productoId: string }>(
  items: T[],
  materialesProveedorIds: string[]
): T[] {
  if (materialesProveedorIds.length === 0) return items;
  return items.filter((item) => materialesProveedorIds.includes(item.productoId));
}

/**
 * true si el proveedor TIENE catálogo y ninguna de estas partidas está en él:
 * con la regla de `filtrarItemsPorMaterialesProveedor`, abriría la licitación
 * y no vería nada. Un proveedor sin catálogo nunca queda así (ve todo), y una
 * licitación sin partidas tampoco cuenta.
 */
export function veNingunaPartida(
  items: { productoId: string }[],
  materialesProveedorIds: string[]
): boolean {
  return (
    items.length > 0 &&
    materialesProveedorIds.length > 0 &&
    filtrarItemsPorMaterialesProveedor(items, materialesProveedorIds).length === 0
  );
}

/**
 * URLs de las fichas técnicas que le corresponden a UN proveedor: las de los
 * materiales de la licitación que ese proveedor puede cotizar (mismo filtro que
 * la tabla personalizada de la invitación).
 *
 * Devuelve las URLs DEDUPLICADAS y en orden de aparición de los materiales —
 * ese orden es el que manda al recortar por tamaño. Dos materiales distintos
 * pueden compartir ficha; se adjunta una sola vez.
 *
 * Puro (sin Prisma): se usa desde Client Components. `fichasPorProducto` mapea
 * productoId → el valor CRUDO de Producto.archivosEspecificaciones (JSON con un
 * array de URLs); se parsea aquí para no repetir el parseo en cada call site.
 */
export function fichasDeProveedor(
  items: { productoId: string }[],
  materialesProveedorIds: string[],
  fichasPorProducto: Record<string, string | null | undefined>
): string[] {
  const items_ = filtrarItemsPorMaterialesProveedor(items, materialesProveedorIds);
  const vistas = new Set<string>();
  const urls: string[] = [];
  for (const item of items_) {
    for (const url of parsearUrlsJson(fichasPorProducto[item.productoId])) {
      if (!url || vistas.has(url)) continue;
      vistas.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Parsea un campo JSON con lista de URLs (Producto.archivosEspecificaciones,
 * Licitacion.archivosAdjuntos). Tolerante: valor nulo, JSON inválido o forma
 * inesperada devuelven [] en vez de lanzar.
 */
export function parsearUrlsJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}
