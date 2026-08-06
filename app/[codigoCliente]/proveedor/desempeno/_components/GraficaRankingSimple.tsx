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

/**
 * Ranking horizontal genérico, SIN línea de acumulado.
 *
 * Lo usan los dos indicadores cuya magnitud NO es aditiva entre productos:
 * la cantidad vendida (mezcla piezas, metros y servicios en un mismo total) y
 * el % de sobrecosto (los porcentajes no se suman). Para los montos —que sí son
 * aditivos— se usa GraficaPareto.
 */
export default function GraficaRankingSimple({
  data,
  color,
  formatValor,
  maxBarras = 12,
}: {
  data: { id: string; etiqueta: string; valor: number; nota?: string }[];
  color: string;
  formatValor: (v: number, fila: { nota?: string }) => string;
  maxBarras?: number;
}) {
  const filas = data.slice(0, maxBarras);

  return (
    <div style={{ height: Math.max(240, filas.length * 30) }}>
      <Bar
        data={{
          labels: filas.map((d) => d.etiqueta),
          datasets: [
            {
              label: "",
              data: filas.map((d) => d.valor),
              backgroundColor: color,
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
                label: (ctx) => formatValor(Number(ctx.parsed.x), filas[ctx.dataIndex]),
              },
            },
          },
          scales: {
            x: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        }}
      />
    </div>
  );
}
