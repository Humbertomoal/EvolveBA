"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function GraficaOnTime({
  data,
}: {
  data: { proveedorNombre: string; porcentaje: number; totalOC: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.proveedorNombre),
    datasets: [
      {
        label: "% On-time",
        data: data.map((d) => d.porcentaje),
        backgroundColor: data.map((d) =>
          d.porcentaje >= 90 ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)"
        ),
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
                label: (ctx) => {
                  const d = data[ctx.dataIndex];
                  return [`${ctx.raw}% on-time`, `Total OC: ${d.totalOC}`];
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { callback: (v) => `${v}%` },
            },
          },
        }}
      />
    </div>
  );
}
