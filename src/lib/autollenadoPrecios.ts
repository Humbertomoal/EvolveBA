/**
 * Autollenado de precios en el portal del proveedor.
 *
 * Cuando el proveedor termina de capturar el precio unitario de una partida,
 * ese precio se copia a las OTRAS partidas del mismo producto (otros sitios de
 * entrega) que tengan el precio vacío. Lo ÚNICO que se copia es el precio.
 *
 * ── Reglas ─────────────────────────────────────────────────────────────────
 * · Destino = mismo productoId, MISMA moneda, la partida en "cotizo" y con el
 *   precio vacío. Nunca pisa un precio que el proveedor tecleó.
 * · Solo el precio unitario. NO se copian: cantidad disponible, "¿Cumples la
 *   fecha?", los estados "No dispongo" / "Sin costo" (cambian por sitio) ni
 *   "Es producto similar" con su descripción. Esa casilla dice que el
 *   proveedor ofrece OTRO producto que reemplaza al pedido: es su juicio para
 *   ESA partida y no se replica. Marcarla o desmarcarla no dispara nada, y un
 *   origen marcado como similar sigue copiando su precio (es su precio para
 *   ese material; en cada sitio decide si ofrece el sustituto).
 * · Partidas no autollenables (flete y seguro, familia Servicios
 *   Profesionales; y Mano de Obra) ni dan ni reciben: cambian por sitio
 *   (traslados, tarifas locales).
 * · La copia queda marcada (`copiadoDe`). Mientras conserve la marca, sigue
 *   al origen: si el proveedor corrige el precio del origen (tecleó 12 en vez
 *   de 120), la copia se corrige también. Cualquier acción deliberada del
 *   proveedor sobre la copia (precio, estado o "similar") le quita la marca
 *   (ver `setFila`) y deja de seguir al origen para siempre. Si el origen se queda sin precio (lo borra, o pasa a "No
 *   dispongo"/"Sin costo"), sus copias CONSERVAN su valor y solo pierden la
 *   marca: nada desaparece de la pantalla sin que el proveedor lo haga, y "No
 *   dispongo" habla de ESE sitio, no de que el precio no valga en los demás.
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
  copiadoDe: CopiaDe | null;
};

export type ItemAutollenado = {
  licitacionItemId: string;
  productoId: string;
  moneda: string;
  /** false para flete y seguro (Servicios Profesionales) y Mano de Obra. */
  autollenable: boolean;
  grupo: { nombre: string } | null;
};

export const FAMILIAS_SIN_AUTOLLENADO = ["Servicios Profesionales", "Mano de Obra"];

export function esAutollenable(familia: string | null | undefined): boolean {
  return !FAMILIAS_SIN_AUTOLLENADO.includes(familia ?? "");
}

/**
 * Copia el precio de la partida `origenId` a sus gemelas. Devuelve el MISMO
 * arreglo si no hay nada que cambiar, para que el setState no provoque un
 * render de más.
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
  // costo"): sus copias se SUELTAN — conservan su precio y pierden la marca,
  // porque "copiado de…" ya no sería cierto. No se vacían: nada desaparece de
  // la pantalla sin que el proveedor lo haga.
  if (origen.estado !== "cotizo" || origen.precioUnitario.trim() === "") {
    return soltarCopiasDe(filas, origenId);
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
    const vacia = f.precioUnitario.trim() === "" && f.copiadoDe === null;
    if (!esMiCopia && !vacia) return f;
    if (esMiCopia && f.precioUnitario === origen.precioUnitario) return f;
    cambio = true;
    return { ...f, precioUnitario: origen.precioUnitario, copiadoDe: copia };
  });
  return cambio ? siguiente : filas;
}

function soltarCopiasDe<F extends FilaAutollenado>(filas: F[], origenId: string): F[] {
  if (!filas.some((f) => f.copiadoDe?.licitacionItemId === origenId)) return filas;
  return filas.map((f) =>
    f.copiadoDe?.licitacionItemId === origenId ? { ...f, copiadoDe: null } : f
  );
}
