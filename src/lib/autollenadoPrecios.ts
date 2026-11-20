/**
 * Autollenado de precios en el portal del proveedor.
 *
 * Cuando el proveedor termina de capturar el precio unitario de una partida,
 * ese precio se copia a las OTRAS partidas del mismo producto (otros sitios de
 * entrega) que sigan vacías. Es el mismo producto en otro sitio, así que viaja
 * también la marca "Es producto similar" con su descripción: sin ella, un
 * precio de un producto similar se presentaría como si fuera del original.
 *
 * ── Reglas ─────────────────────────────────────────────────────────────────
 * · Destino = mismo productoId, MISMA moneda, la partida en "cotizo" y vacía
 *   (sin precio, sin marca de similar ni descripción). Nunca pisa algo que el
 *   proveedor tecleó.
 * · Solo precio + similar. Cantidad disponible, "¿Cumples la fecha?" y los
 *   estados "No dispongo" / "Sin costo" NO se copian: cambian por sitio.
 * · Partidas no autollenables (flete y seguro, familia Servicios
 *   Profesionales) ni dan ni reciben.
 * · La copia queda marcada (`copiadoDe`). Mientras conserve la marca es una
 *   copia VIVA: si el proveedor corrige el precio de la partida origen o marca
 *   después "similar", la copia se actualiza. Por eso el orden de captura (precio
 *   primero, casilla después) no deja copias sin la marca de similar. En cuanto
 *   el proveedor toca precio, estado o similar en la copia, la marca se va
 *   (ver `setFila`) y la partida es suya: ya no se vuelve a tocar. Si el
 *   origen se queda sin precio (lo borra, o pasa a "No dispongo"/"Sin costo"),
 *   sus copias vivas vuelven a vacío.
 * · Todo se resuelve por licitacionItemId, nunca por posición.
 *
 * Módulo puro: sin React ni Prisma, para poder probarlo aparte
 * (scripts/pruebas/autollenado.ts).
 */

export type CopiaDe = { licitacionItemId: string; etiqueta: string };

export type FilaAutollenado = {
  licitacionItemId: string;
  precioUnitario: string;
  estado: string;
  esProductoSimilar: boolean;
  productoSimilarDetalle: string;
  copiadoDe: CopiaDe | null;
};

export type ItemAutollenado = {
  licitacionItemId: string;
  productoId: string;
  moneda: string;
  /** false para flete y seguro (familia Servicios Profesionales). */
  autollenable: boolean;
  grupo: { nombre: string } | null;
};

export const FAMILIAS_SIN_AUTOLLENADO = ["Servicios Profesionales"];

export function esAutollenable(familia: string | null | undefined): boolean {
  return !FAMILIAS_SIN_AUTOLLENADO.includes(familia ?? "");
}

function vacia(f: FilaAutollenado): boolean {
  return (
    f.precioUnitario.trim() === "" &&
    !f.esProductoSimilar &&
    f.productoSimilarDetalle.trim() === "" &&
    f.copiadoDe === null
  );
}

/**
 * Copia el precio (y la marca de similar) de la partida `origenId` a sus
 * gemelas. Devuelve el MISMO arreglo si no hay nada que cambiar, para que el
 * setState no provoque un render de más.
 */
export function propagarDesde<F extends FilaAutollenado>(
  filas: F[],
  items: ItemAutollenado[],
  origenId: string
): F[] {
  const itemPorId = new Map(items.map((i) => [i.licitacionItemId, i]));
  const origenItem = itemPorId.get(origenId);
  const origen = filas.find((f) => f.licitacionItemId === origenId);
  if (!origenItem || !origen || !origenItem.autollenable) return filas;
  // Una copia que nadie ha tocado no es origen de nada: evita cadenas A→B→C.
  if (origen.copiadoDe) return filas;
  // El origen ya no tiene precio (lo borró, o pasó a "No dispongo" / "Sin
  // costo"): sus copias vivas vuelven a quedar vacías. Esos estados no se
  // copian, y dejar el precio viejo con "copiado de…" mentiría.
  if (origen.estado !== "cotizo" || origen.precioUnitario.trim() === "") {
    return vaciarCopiasDe(filas, origenId);
  }
  const precio = Number(origen.precioUnitario);
  // Precio inválido (0, negativo): el validador de la fila lo marca; no se copia.
  if (!Number.isFinite(precio) || precio <= 0) return filas;

  const copia: CopiaDe = {
    licitacionItemId: origenId,
    etiqueta: origenItem.grupo?.nombre ?? "partida sin grupo",
  };
  let cambio = false;
  const siguiente = filas.map((f) => {
    if (f.licitacionItemId === origenId) return f;
    const item = itemPorId.get(f.licitacionItemId);
    if (
      !item ||
      !item.autollenable ||
      item.productoId !== origenItem.productoId ||
      item.moneda !== origenItem.moneda ||
      f.estado !== "cotizo"
    ) {
      return f;
    }
    const esMiCopia = f.copiadoDe?.licitacionItemId === origenId;
    if (!esMiCopia && !vacia(f)) return f;
    if (
      esMiCopia &&
      f.precioUnitario === origen.precioUnitario &&
      f.esProductoSimilar === origen.esProductoSimilar &&
      f.productoSimilarDetalle === origen.productoSimilarDetalle
    ) {
      return f;
    }
    cambio = true;
    return {
      ...f,
      precioUnitario: origen.precioUnitario,
      esProductoSimilar: origen.esProductoSimilar,
      productoSimilarDetalle: origen.productoSimilarDetalle,
      copiadoDe: copia,
    };
  });
  return cambio ? siguiente : filas;
}

function vaciarCopiasDe<F extends FilaAutollenado>(filas: F[], origenId: string): F[] {
  if (!filas.some((f) => f.copiadoDe?.licitacionItemId === origenId)) return filas;
  return filas.map((f) =>
    f.copiadoDe?.licitacionItemId === origenId
      ? { ...f, precioUnitario: "", esProductoSimilar: false, productoSimilarDetalle: "", copiadoDe: null }
      : f
  );
}
