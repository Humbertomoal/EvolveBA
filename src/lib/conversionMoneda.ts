// ─────────────────────────────────────────────────────────────────────────────
// Conversión de moneda — helper centralizado.
//
// Modelo: las tasas (`tiposCambio`) se expresan SIEMPRE respecto a MXN
// (Licitacion.tiposCambio Json?), p. ej. { USD: 17.20 } = 1 USD → 17.20 MXN.
// MXN es la moneda pivote y vale 1; no se captura.
//
// La consolidación puede hacerse en CUALQUIER moneda (`monedaConsolidacion` de
// la licitación, default MXN) vía `convertirAMoneda`, que cruza por MXN:
//   monto_destino = monto * tasa(origen) / tasa(destino)
//
// Retrocompatibilidad (importante):
//   - tiposCambio null/vacío + todo MXN  → funciona igual que antes (sin conversión).
//   - tiposCambio null + monedas ≠ MXN   → NO truena: se usa tasa 1 por moneda y
//     el UI debe mostrar el aviso de `faltanTiposCambio` para que el comprador
//     capture las tasas.
// ─────────────────────────────────────────────────────────────────────────────

import { formatImporte } from "./monedas";

/** Moneda pivote de las tasas (todas las tasas de `tiposCambio` son "a MXN"). */
export const MONEDA_BASE = "MXN";

/** Tasas respecto a MXN, ej. { USD: 17.20, EUR: 19.50 }. MXN no se incluye. */
export type TiposCambio = Record<string, number>;

/**
 * Normaliza el valor crudo del campo `Licitacion.tiposCambio` (Prisma Json?,
 * que llega como `unknown | null`) a un mapa limpio de tasas válidas (> 0).
 * Entradas inválidas o ≤ 0 se descartan.
 */
export function parseTiposCambio(raw: unknown): TiposCambio {
  if (!raw || typeof raw !== "object") return {};
  const out: TiposCambio = {};
  for (const [moneda, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (moneda === MONEDA_BASE) continue; // MXN siempre vale 1, no se guarda
    const tasa = typeof valor === "number" ? valor : Number(valor);
    if (Number.isFinite(tasa) && tasa > 0) out[moneda] = tasa;
  }
  return out;
}

/**
 * Tasa de una moneda respecto a MXN. MXN → 1. Moneda sin tasa registrada → 1
 * (retrocompatibilidad; el aviso de `faltanTiposCambio` avisa al usuario).
 */
export function tasaDe(
  moneda: string,
  tiposCambio: TiposCambio | null | undefined
): number {
  if (moneda === MONEDA_BASE) return 1;
  const tasa = tiposCambio?.[moneda];
  return typeof tasa === "number" && tasa > 0 ? tasa : 1;
}

/**
 * Convierte `monto` de `origen` a `destino` cruzando por MXN (la moneda pivote
 * de las tasas):  monto_destino = monto * tasa(origen) / tasa(destino).
 * Único punto donde vive la fórmula: NO la dupliques en los call sites.
 */
export function convertirAMoneda(
  monto: number,
  origen: string,
  destino: string,
  tiposCambio: TiposCambio | null | undefined
): number {
  if (!Number.isFinite(monto)) return 0;
  if ((origen || MONEDA_BASE) === (destino || MONEDA_BASE)) return monto;
  const tasaDestino = tasaDe(destino, tiposCambio);
  // tasaDe nunca devuelve ≤ 0, pero por seguridad evitamos dividir por cero.
  if (tasaDestino <= 0) return monto * tasaDe(origen, tiposCambio);
  return (monto * tasaDe(origen, tiposCambio)) / tasaDestino;
}

/** Atajo: convierte a MXN (moneda pivote). Equivale a `convertirAMoneda(_, _, "MXN", _)`. */
export function convertirAMXN(
  monto: number,
  moneda: string,
  tiposCambio: TiposCambio | null | undefined
): number {
  return convertirAMoneda(monto, moneda, MONEDA_BASE, tiposCambio);
}

/** Monedas distintas de MXN presentes en una lista de códigos de moneda. */
export function monedasNoMXN(monedas: Iterable<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const m of monedas) {
    const codigo = m || MONEDA_BASE;
    if (codigo !== MONEDA_BASE) set.add(codigo);
  }
  return [...set].sort();
}

/**
 * true si falta la tasa (a MXN) de alguna moneda necesaria para consolidar:
 * las monedas en uso ≠ MXN y, si la consolidación no es MXN, también la propia
 * moneda de consolidación. Dispara el aviso visible "Faltan tipos de cambio…".
 */
export function faltanTiposCambio(
  monedasEnUso: Iterable<string | null | undefined>,
  tiposCambio: TiposCambio | null | undefined,
  monedaConsolidacion: string = MONEDA_BASE
): boolean {
  for (const moneda of monedasNoMXN([...monedasEnUso, monedaConsolidacion])) {
    const tasa = tiposCambio?.[moneda];
    if (!(typeof tasa === "number" && tasa > 0)) return true;
  }
  return false;
}

/** Formatea una tasa para mostrarla, ej. 17.2 → "17.20", 17.2345 → "17.2345". */
export function formatTasa(tasa: number): string {
  return tasa.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/**
 * Nota discreta de las tasas usadas para consolidar, ej.
 *   "Totales en MXN · TC USD 17.20"                 (consolida en MXN)
 *   "Totales en USD · TC USD 17.20 · EUR 19.50"     (consolida en USD)
 * Lista la tasa (a MXN) de cada moneda involucrada en la conversión, incluida
 * la de consolidación si no es MXN. Devuelve null cuando no hubo conversión
 * (todo en la misma moneda de consolidación) → no se muestra nada.
 */
export function notaTipoCambio(
  monedasEnUso: Iterable<string | null | undefined>,
  tiposCambio: TiposCambio | null | undefined,
  monedaConsolidacion: string = MONEDA_BASE
): string | null {
  const destino = monedaConsolidacion || MONEDA_BASE;
  // ¿Hay al menos un monto en una moneda distinta a la de consolidación?
  let hayConversion = false;
  for (const m of monedasEnUso) {
    if ((m || MONEDA_BASE) !== destino) {
      hayConversion = true;
      break;
    }
  }
  if (!hayConversion) return null;
  const relevantes = monedasNoMXN([...monedasEnUso, destino]);
  if (relevantes.length === 0) return null;
  const partes = relevantes.map((m) => `${m} ${formatTasa(tasaDe(m, tiposCambio))}`);
  return `Totales en ${destino} · TC ${partes.join(" · ")}`;
}

/**
 * Presentación combinada de una línea: su importe en la moneda ORIGINAL más la
 * equivalencia en la de consolidación, p. ej.
 *   "$1,500.00 USD (≈ $26,160.00 MXN)"
 * Si la línea ya está en la moneda de destino no duplica: devuelve un solo
 * importe. Pensada para las vistas del PROVEEDOR, que necesitan saber en qué
 * moneda se les paga y cuánto equivale con el TC congelado de la licitación.
 *
 * El "≈" es deliberado: la equivalencia es informativa: el importe que manda es
 * el de la moneda original de la línea, que es la que va en la orden de compra.
 */
export function formatMontoConEquivalencia(
  monto: number,
  moneda: string,
  tiposCambio: TiposCambio | null | undefined,
  monedaDestino: string = MONEDA_BASE
): string {
  const destino = monedaDestino || MONEDA_BASE;
  if ((moneda || MONEDA_BASE) === destino) {
    return formatImporte(monto, destino);
  }
  const convertido = convertirAMoneda(monto, moneda, destino, tiposCambio);
  return `${formatImporte(monto, moneda)} (≈ ${formatImporte(convertido, destino)})`;
}
