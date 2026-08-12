"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// ⚠️ Blindaje pg/util-types: este archivo es "use client", así que solo puede
// importar del módulo PURO. dashboardQueries.ts (que arrastra prisma → pg →
// node:util) NO puede aparecer aquí ni siquiera como `import type`.
import {
  formatMonto,
  formatMontoCorto,
  type PuntoAhorroMes,
} from "@/src/lib/dashboardTypes";

export default function AhorroMensualChart({
  data,
}: {
  data: PuntoAhorroMes[];
}) {
  const sinDatos = data.every((d) => d.ahorro === 0);

  if (sinDatos) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-zinc-500">Todavía no hay ahorro que graficar</p>
        <p className="max-w-xs text-xs text-zinc-400">
          Las barras aparecen cuando se cierra una licitación con ofertas.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAhorro" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-primario, #004439)"
                stopOpacity={0.95}
              />
              <stop
                offset="100%"
                stopColor="var(--color-primario, #004439)"
                stopOpacity={0.55}
              />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="#ede8e8" />
          <XAxis
            dataKey="etiqueta"
            tick={{ fontSize: 12, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(valor: number) => formatMontoCorto(valor)}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #ede8e8",
              fontSize: 12,
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            }}
            formatter={(valor) => [formatMonto(Number(valor)), "Ahorro (MXN)"]}
          />
          <Bar dataKey="ahorro" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {/* Un ahorro negativo (el precio final salió por encima de la
                línea base) se pinta en rojo en vez de disfrazarse del mismo
                verde que el ahorro real. */}
            {data.map((punto) => (
              <Cell
                key={punto.mes}
                fill={punto.ahorro < 0 ? "#ef4444" : "url(#gradAhorro)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
