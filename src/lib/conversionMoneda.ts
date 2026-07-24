// ─────────────────────────────────────────────────────────────────────────────
// Conversión de moneda a MXN — helper centralizado.
//
// Modelo: moneda base MXN + tipos de cambio manuales congelados por licitación
// (Licitacion.tiposCambio Json?). MXN siempre vale 1 y no se captura.
//
// Retrocompatibilidad (importante):
//   - tiposCambio null/vacío + todo MXN  → funciona igual que antes (sin conversión).
//   - tiposCambio null + monedas ≠ MXN   → NO truena: se usa tasa 1 por moneda y
//     el UI debe mostrar el aviso de `faltanTiposCambio` para que el comprador
//     capture las tasas.
//
// TODO (futuro, fuera de alcance): obtención automática de tasas desde una API.
// ─────────────────────────────────────────────────────────────────────────────

import { formatImporte } from "./monedas";

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
 * Convierte `monto` (en `moneda`) a MXN usando las tasas congeladas.
 * Único punto donde vive la fórmula: NO la dupliques en los call sites.
 */
export function convertirAMXN(
  monto: number,
  moneda: string,
  tiposCambio: TiposCambio | null | undefined
): number {
  if (!Number.isFinite(monto)) return 0;
  return monto * tasaDe(moneda, tiposCambio);
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
 * true si alguna moneda en uso (distinta de MXN) no tiene una tasa válida
 * registrada. Dispara el aviso visible "Faltan tipos de cambio…".
 */
export function faltanTiposCambio(
  monedasEnUso: Iterable<string | null | undefined>,
  tiposCambio: TiposCambio | null | undefined
): boolean {
  for (const moneda of monedasNoMXN(monedasEnUso)) {
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
 * Nota discreta del tipo de cambio usado, ej.
 *   "Totales en MXN · TC USD 17.20"        (una moneda)
 *   "Totales en MXN · TC USD 17.20 · EUR 19.50"  (varias)
 * Devuelve null cuando no hubo conversión (todo MXN) → no se muestra nada.
 */
export function notaTipoCambio(
  monedasEnUso: Iterable<string | null | undefined>,
  tiposCambio: TiposCambio | null | undefined
): string | null {
  const monedas = monedasNoMXN(monedasEnUso);
  if (monedas.length === 0) return null;
  const partes = monedas.map((m) => `${m} ${formatTasa(tasaDe(m, tiposCambio))}`);
  return `Totales en MXN · TC ${partes.join(" · ")}`;
}

/**
 * Presentación combinada "USD 1,200 (MXN 20,640)" para una línea individual
 * cuando ayuda mostrar ambos. Si la moneda ya es MXN, devuelve solo el MXN.
 */
export function formatMontoConMXN(
  monto: number,
  moneda: string,
  tiposCambio: TiposCambio | null | undefined
): string {
  if ((moneda || MONEDA_BASE) === MONEDA_BASE) {
    return formatImporte(monto, MONEDA_BASE);
  }
  const enMXN = convertirAMXN(monto, moneda, tiposCambio);
  return `${formatImporte(monto, moneda)} (${formatImporte(enMXN, MONEDA_BASE)})`;
}
