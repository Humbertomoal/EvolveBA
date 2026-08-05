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
import { formatDuracionHoras } from "@/src/lib/tableroEtapas";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function GraficaTiempoEtapas({
  data,
}: {
  data: { etapa: string; promedioHoras: number; licitaciones: number }[];
}) {
  const chartData = {
    labels: data.map((d) => d.etapa),
    datasets: [
      {
        label: "Horas promedio",
        data: data.map((d) => d.promedioHoras),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
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
                // El eje va en horas para que las etapas sean comparables entre
                // sí; el tooltip traduce a la unidad legible (min/h/días).
                label: (ctx) => {
                  const fila = data[ctx.dataIndex];
                  return `${formatDuracionHoras(fila.promedioHoras)} · ${fila.licitaciones} licitacion${
                    fila.licitaciones === 1 ? "" : "es"
                  }`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Horas promedio" },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
