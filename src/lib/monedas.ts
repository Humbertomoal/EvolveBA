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
