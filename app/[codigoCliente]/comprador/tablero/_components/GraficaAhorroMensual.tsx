"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function GraficaAhorroMensual({
  data,
}: {
  data: { mes: string; etiqueta: string; ahorro: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.etiqueta),
    datasets: [
      {
        label: "Ahorro (MXN)",
        data: data.map((d) => d.ahorro),
        backgroundColor: "rgba(34, 197, 94, 0.8)",
        borderRadius: 4,
      },
    ],
  };

  return (
    <div style={{ height: 260 }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Ahorro: $${fmt(Number(ctx.parsed.y))} MXN`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
