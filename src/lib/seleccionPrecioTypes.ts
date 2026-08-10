// Tipos de la selección de precio del comprador. Módulo PURO (0 imports).
//
// Viven aquí y no en seleccionPrecioActions.ts porque ese archivo es
// "use server", y un `export type { X }` ahí se compila mal: Turbopack arma la
// lista de exports antes de que TypeScript borre los tipos y emite una
// referencia a un símbolo inexistente → ReferenceError al evaluar el módulo.
// Ya nos costó una caída en producción. Un "use server" exporta SOLO funciones
// async.

/**
 * Decisión guardada del comprador para un (partida, proveedor).
 *
 * Los dos campos son independientes a propósito: elegir un registro del
 * histórico y negociar un precio son actos distintos. Se puede tener uno, el
 * otro, o ambos.
 */
export type SeleccionPrecio = {
  licitacionItemId: string;
  proveedorId: string;
  /** OfertaItem.id elegido del histórico. null = usar el mínimo automático. */
  ofertaItemId: string | null;
  /** Ajuste de negociación. null = usar el precio del registro. */
  precioNegociado: number | null;
};

export type ResultadoSeleccion =
  | { ok: true }
  | { ok: false; mensaje: string };

/** Clave del mapa de selecciones. Un solo lugar para no desalinear el formato. */
export function claveSeleccion(licitacionItemId: string, proveedorId: string): string {
  return `${licitacionItemId}::${proveedorId}`;
}
