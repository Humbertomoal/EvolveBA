/**
 * Asignación automática de productos NUEVOS al catálogo de los proveedores que
 * ya tienen su familia asignada.
 *
 * ── Por qué ────────────────────────────────────────────────────────────────
 * El portal filtra las partidas por catálogo (ProveedorMaterial, por
 * producto). Un producto recién creado no estaba en el catálogo de nadie, así
 * que quedaba invisible justo para quien lo surte. Así nacieron los 34
 * materiales huérfanos de la licitación 0029.
 *
 * ── Cuándo aplica ──────────────────────────────────────────────────────────
 * Solo al CREAR un producto: crearProducto (formulario del catálogo) y
 * scripts/cargar-materiales-electricos.ts. Un producto nuevo nunca pudo ser
 * desmarcado por nadie, así que asignarlo no deshace ninguna decisión. Para
 * productos que ya existían está scripts/asignar-materiales-por-familia.ts,
 * que respeta las posibles desmarcas.
 *
 * ── Qué cuenta como familia asignada ──────────────────────────────────────
 * La misma lectura que getFamiliasAsignadasProveedor: Proveedor.familiasAsignadas
 * y, si está vacía, el dato legado ProveedorMaterial.familias. Solo
 * proveedores no eliminados.
 *
 * Recibe el cliente (o la transacción) como parámetro y NO importa la
 * instancia de Prisma: así corre dentro de la misma transacción que crea el
 * producto, y un script con su propio cliente no abre una segunda conexión.
 */
import type { Prisma } from ".prisma/client/default";

type ClienteCatalogo = Pick<Prisma.TransactionClient, "proveedor" | "proveedorMaterial">;

export type FilaCatalogo = { proveedorId: string; productoId: string; familias: string };

function parsearFamilias(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** proveedorId → familias asignadas, solo proveedores no eliminados. */
export async function familiasAsignadasPorProveedor(
  cliente: ClienteCatalogo
): Promise<Map<string, string[]>> {
  const proveedores = await cliente.proveedor.findMany({
    where: { eliminado: false },
    select: { id: true, familiasAsignadas: true },
  });
  const vigentes = new Set(proveedores.map((p) => p.id));
  const mapa = new Map<string, string[]>();
  for (const p of proveedores) {
    const familias = parsearFamilias(p.familiasAsignadas);
    if (familias.length > 0) mapa.set(p.id, familias);
  }
  // Legado: familias guardadas solo en ProveedorMaterial.
  const legado = await cliente.proveedorMaterial.findMany({
    where: { familias: { not: null } },
    select: { proveedorId: true, familias: true },
  });
  for (const r of legado) {
    if (!vigentes.has(r.proveedorId) || mapa.has(r.proveedorId)) continue;
    const familias = parsearFamilias(r.familias);
    if (familias.length > 0) mapa.set(r.proveedorId, familias);
  }
  return mapa;
}

/**
 * Filas de ProveedorMaterial para asignar cada producto a los proveedores que
 * tienen su familia. Un producto sin familia no se asigna a nadie.
 */
export async function filasCatalogoPorFamilia(
  cliente: ClienteCatalogo,
  productos: { id: string; familia: string | null }[]
): Promise<FilaCatalogo[]> {
  if (!productos.some((p) => p.familia)) return [];
  const familiasPorProveedor = await familiasAsignadasPorProveedor(cliente);
  const filas: FilaCatalogo[] = [];
  for (const prod of productos) {
    if (!prod.familia) continue;
    for (const [proveedorId, familias] of familiasPorProveedor) {
      if (familias.includes(prod.familia)) {
        filas.push({ proveedorId, productoId: prod.id, familias: JSON.stringify(familias) });
      }
    }
  }
  return filas;
}
