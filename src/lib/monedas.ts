export type Moneda = { codigo: string; nombre: string; simbolo: string };

export const MONEDAS: Moneda[] = [
  { codigo: "MXN", nombre: "Peso Mexicano",     simbolo: "$" },
  { codigo: "USD", nombre: "Dólar Americano",   simbolo: "$" },
  { codigo: "EUR", nombre: "Euro",              simbolo: "€" },
  { codigo: "COP", nombre: "Peso Colombiano",   simbolo: "$" },
  { codigo: "DOP", nombre: "Peso Dominicano",   simbolo: "$" },
  { codigo: "CAD", nombre: "Dólar Canadiense",  simbolo: "$" },
  { codigo: "GBP", nombre: "Libra Esterlina",   simbolo: "£" },
];

export const MONEDA_SIMBOLO: Record<string, string> = Object.fromEntries(
  MONEDAS.map((m) => [m.codigo, m.simbolo])
);

export function formatImporte(n: number, moneda: string): string {
  const sym = MONEDA_SIMBOLO[moneda] ?? "$";
  return `${sym}${n.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${moneda}`;
}

/** Cómo se lee un ganador que no cobra. Una sola constante para las 5 pantallas. */
export const ETIQUETA_GRATIS = "Gratis";

/**
 * Texto de un precio ganador. Módulo puro, así que sirve en cliente y servidor.
 *
 * Distingue los TRES desenlaces que un importe suelto confunde:
 *
 *   null → nadie cotizó de verdad (todos "no dispongo") → "—"
 *   0    → alguien la ofrece SIN COSTO y ganó → "Gratis"
 *   > 0  → precio normal → lo que diga `formatear`
 *
 * El 0 se pinta con palabra y no como "$0.00" a propósito: un cero seco en una
 * columna de precios se lee como error o como dato faltante, que es justo la
 * ambigüedad que el tercer estado vino a eliminar. Y no puede colapsarse con
 * el caso `null`: "no hay ganador" y "el ganador no cobra" son desenlaces
 * opuestos —uno deja la partida sin resolver y el otro la resuelve del todo—.
 *
 * `formatear` lo pone cada pantalla porque unas llevan moneda y otras no.
 */
export function textoPrecioGanador(
  precio: number | null | undefined,
  formatear: (valor: number) => string,
  opciones?: { sinGanador?: string }
): string {
  if (precio === null || precio === undefined) return opciones?.sinGanador ?? "—";
  if (precio === 0) return ETIQUETA_GRATIS;
  return formatear(precio);
}
