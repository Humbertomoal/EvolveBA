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

export default function GraficaAhorro({
  data,
}: {
  data: { productoNombre: string; ahorroTotal: number }[];
}) {
  const top = data.slice(0, 10);
  const chartData = {
    labels: top.map((d) => d.productoNombre),
    datasets: [
      {
        label: "Ahorro ($)",
        data: top.map((d) => d.ahorroTotal),
        backgroundColor: "rgba(20, 184, 166, 0.8)",
        borderRadius: 4,
      },
    ],
  };

  return (
    <div style={{ height: Math.max(220, top.length * 38) }}>
      <Bar
        data={chartData}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Ahorro: $${fmt(ctx.raw as number)}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
            },
          },
        }}
      />
    </div>
  );
}
