"use client";

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = [
  "rgba(59, 130, 246, 0.85)",
  "rgba(20, 184, 166, 0.85)",
  "rgba(168, 85, 247, 0.85)",
  "rgba(249, 115, 22, 0.85)",
  "rgba(236, 72, 153, 0.85)",
  "rgba(234, 179, 8, 0.85)",
];

export default function GraficaAdherencia({
  data,
}: {
  data: { jerarquia: string; porcentaje: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.jerarquia),
    datasets: [
      {
        data: data.map((d) => d.porcentaje),
        backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  return (
    <div style={{ height: 260 }}>
      <Doughnut
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: {
            legend: { position: "right" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.raw}% adherencia`,
              },
            },
          },
        }}
      />
    </div>
  );
}
