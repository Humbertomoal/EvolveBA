"use client";

import { VENTANAS } from "@/src/lib/tableroHistorico";

/**
 * Selector de ventana propio de cada gráfico del análisis histórico. "Mes
 * anterior" es el mes CALENDARIO completo anterior; las demás son ventanas
 * móviles que terminan hoy — se distingue en el propio texto de la opción para
 * que nadie asuma que "mes anterior" son los últimos 30 días.
 */
export default function SelectorPeriodo({
  valor,
  onChange,
  ariaLabel,
}: {
  valor: string;
  onChange: (valor: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {VENTANAS.map((v) => (
        <option key={v.valor} value={v.valor}>
          {v.valor === "mes_anterior" ? `${v.label} (calendario)` : v.label}
        </option>
      ))}
    </select>
  );
}
