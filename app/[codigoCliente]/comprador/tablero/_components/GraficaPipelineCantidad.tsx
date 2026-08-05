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
import { COLOR_CATEGORIA, SERIES_PIPELINE } from "./pipelineSeries";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/**
 * Barras APILADAS: las 6 categorías son disjuntas, así que la altura total de
 * cada mes es el número de licitaciones de ese mes y apilar significa algo.
 * ("Cerradas sin OC enviada" NO va aquí: es un subconjunto de Terminadas y
 * apilarla contaría dos veces las mismas licitaciones.)
 */
export default function GraficaPipelineCantidad({
  data,
}: {
  data: { mes: string; etiqueta: string; porCategoria: Record<string, number> }[];
}) {
  const chartData = {
    labels: data.map((d) => d.etiqueta),
    datasets: SERIES_PIPELINE.map((serie) => ({
      label: serie.label,
      data: data.map((d) => d.porCategoria[serie.clave] ?? 0),
      backgroundColor: COLOR_CATEGORIA[serie.clave],
      borderRadius: 3,
      stack: "pipeline",
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
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: { precision: 0 },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        }}
      />
    </div>
  );
}
