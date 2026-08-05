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
import { COLOR_CATEGORIA, SERIES_PIPELINE } from "./pipelineSeries";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/**
 * Barras AGRUPADAS, no apiladas: los tiempos promedio no se suman entre
 * categorías, así que apilarlos daría una altura total sin significado.
 */
export default function GraficaPipelineTiempo({
  data,
}: {
  data: {
    mes: string;
    etiqueta: string;
    porCategoria: Record<string, number | null>;
  }[];
}) {
  const chartData = {
    labels: data.map((d) => d.etiqueta),
    datasets: SERIES_PIPELINE.map((serie) => ({
      label: serie.label,
      // null (categoría sin licitaciones ese mes) deja hueco en vez de dibujar
      // un cero, que se leería como "tardó 0 horas".
      data: data.map((d) => d.porCategoria[serie.clave] ?? null),
      backgroundColor: COLOR_CATEGORIA[serie.clave],
      borderRadius: 3,
    })),
  };

  return (
    <div style={{ height: 280 }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${ctx.dataset.label}: ${formatDuracionHoras(Number(ctx.parsed.y))}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Horas promedio" },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        }}
      />
    </div>
  );
}
