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
  n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Ranking simple, deliberadamente SIN línea de acumulado: los precios unitarios
 * no son aditivos entre productos, así que un "% acumulado" no significaría
 * nada. Además cada producto trae su propia unidad de medida, por eso va en la
 * etiqueta: rankear $/pieza contra $/tonelada exige ver de qué unidad se habla.
 */
export default function GraficaRankingUnitario({
  data,
  maxBarras = 15,
}: {
  data: {
    productoId: string;
    etiqueta: string;
    unidad: string;
    precioPromedio: number;
  }[];
  maxBarras?: number;
}) {
  const filas = data.slice(0, maxBarras);

  // Hay productos reales con unidadMedida vacía (los paneles e inversores del
  // catálogo, p. ej.). Sin este guard la etiqueta queda como "PANEL … ()".
  const conUnidad = (etiqueta: string, unidad: string) =>
    unidad.trim() ? `${etiqueta} (${unidad.trim()})` : etiqueta;

  return (
    <div style={{ height: Math.max(260, filas.length * 30) }}>
      <Bar
        data={{
          labels: filas.map((d) => conUnidad(d.etiqueta, d.unidad)),
          datasets: [
            {
              label: "Costo unitario promedio (MXN)",
              data: filas.map((d) => d.precioPromedio),
              backgroundColor: "rgba(59, 130, 246, 0.8)",
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: "y" as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const fila = filas[ctx.dataIndex];
                  const unidad = fila.unidad.trim() || "unidad";
                  return `$${fmt(Number(ctx.parsed.x))} MXN por ${unidad}`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        }}
      />
    </div>
  );
}
