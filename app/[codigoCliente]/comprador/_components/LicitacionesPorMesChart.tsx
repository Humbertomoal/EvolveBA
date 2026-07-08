"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LicitacionesPorMesPunto = { mes: string; total: number };

export default function LicitacionesPorMesChart({
  data,
}: {
  data: LicitacionesPorMesPunto[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ede8e8" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 12, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #ede8e8",
              fontSize: 12,
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            }}
            formatter={(value) => [value, "Licitaciones"]}
          />
          <Bar
            dataKey="total"
            fill="var(--color-primario, #004439)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
