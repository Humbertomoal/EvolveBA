"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
);

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Evolución del costo unitario promedio (ponderado por cantidad) de UN producto.
 *
 * Los meses sin compras llegan como null y se dibujan como HUECO —no como cero,
 * que se leería como "ese mes salió gratis"—. `spanGaps: false` mantiene el
 * corte visible en vez de trazar una recta que sugeriría continuidad inventada.
 */
export default function GraficaVariacionPrecio({
  data,
}: {
  data: {
    mes: string;
    etiqueta: string;
    precioPromedio: number | null;
    cantidad: number;
  }[];
}) {
  return (
    <div style={{ height: 260 }}>
      <Line
        data={{
          labels: data.map((d) => d.etiqueta),
          datasets: [
            {
              label: "Costo unitario promedio (MXN)",
              data: data.map((d) => d.precioPromedio),
              borderColor: "rgba(20, 184, 166, 0.95)",
              backgroundColor: "rgba(20, 184, 166, 0.12)",
              borderWidth: 2,
              pointRadius: 3,
              fill: true,
              spanGaps: false,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const fila = data[ctx.dataIndex];
                  if (fila.precioPromedio == null) return "Sin compras";
                  return `$${fmt(fila.precioPromedio)} MXN · ${fila.cantidad.toLocaleString("es-MX")} unidades`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              // No arranca en cero: la variación de precio se aprecia en el
              // rango donde ocurre, y forzar el cero la aplanaría.
              beginAtZero: false,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        }}
      />
    </div>
  );
}
