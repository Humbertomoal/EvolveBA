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

export default function GraficaPrecios({
  data,
}: {
  data: { numero: string; precioInicial: number; precioFinal: number }[];
}) {
  const chartData = {
    labels: data.map((d) => `Lic. ${d.numero}`),
    datasets: [
      {
        label: "Precio inicial (ronda 1)",
        data: data.map((d) => d.precioInicial),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderRadius: 4,
      },
      {
        label: "Precio final adjudicado",
        data: data.map((d) => d.precioFinal),
        backgroundColor: "rgba(34, 197, 94, 0.8)",
        borderRadius: 4,
      },
    ],
  };

  return (
    <div style={{ height: 300 }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: $${fmt(ctx.raw as number)}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
            },
          },
        }}
      />
    </div>
  );
}
