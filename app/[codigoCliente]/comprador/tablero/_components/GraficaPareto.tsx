"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { FilaPareto } from "@/src/lib/tableroHistorico";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Pareto: barras del valor (eje izq.) + línea de % acumulado (eje der. 0-100).
 *
 * SOLO válido con magnitudes ADITIVAS —ahorro, monto—, donde el acumulado
 * responde "qué pocos concentran el grueso". Un precio unitario promedio no se
 * suma entre productos, así que ese indicador usa GraficaRankingUnitario.
 */
export default function GraficaPareto({
  data,
  etiquetaValor,
  maxBarras = 15,
}: {
  data: FilaPareto[];
  etiquetaValor: string;
  maxBarras?: number;
}) {
  const filas = data.slice(0, maxBarras);

  return (
    <div style={{ height: Math.max(280, filas.length * 26) }}>
      <Chart
        type="bar"
        data={{
          labels: filas.map((d) => d.etiqueta),
          datasets: [
            {
              type: "bar" as const,
              label: etiquetaValor,
              data: filas.map((d) => d.valor),
              backgroundColor: "rgba(20, 184, 166, 0.8)",
              borderRadius: 4,
              yAxisID: "y",
              order: 2,
            },
            {
              type: "line" as const,
              label: "% acumulado",
              data: filas.map((d) => d.porcentajeAcumulado),
              borderColor: "rgba(245, 158, 11, 0.95)",
              backgroundColor: "rgba(245, 158, 11, 0.95)",
              borderWidth: 2,
              pointRadius: 3,
              yAxisID: "yPct",
              order: 1,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  ctx.dataset.yAxisID === "yPct"
                    ? `% acumulado: ${ctx.parsed.y}%`
                    : `${etiquetaValor}: $${fmt(Number(ctx.parsed.y))} MXN`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: {
              beginAtZero: true,
              position: "left",
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            yPct: {
              beginAtZero: true,
              max: 100,
              position: "right",
              ticks: { callback: (v) => `${v}%` },
              grid: { display: false },
            },
          },
        }}
      />
    </div>
  );
}
