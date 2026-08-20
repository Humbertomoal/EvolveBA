"use client";

import { textoPrecioGanador } from "@/src/lib/monedas";
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
 * Los 3 proveedores con MEJOR precio unitario promedio del producto elegido.
 * Verde el más barato: aquí "mejor" es más bajo, al revés que en casi todas las
 * demás gráficas del tablero, y conviene que se lea de un vistazo.
 */
export default function GraficaTop3Proveedores({
  data,
}: {
  data: {
    proveedorId: string;
    proveedorNombre: string;
    precioPromedio: number;
    cantidad: number;
  }[];
}) {
  return (
    <div style={{ height: 240 }}>
      <Bar
        data={{
          labels: data.map((d) => d.proveedorNombre),
          datasets: [
            {
              label: "Precio unitario promedio (MXN)",
              data: data.map((d) => d.precioPromedio),
              backgroundColor: data.map((_, i) =>
                i === 0 ? "rgba(34, 197, 94, 0.85)" : "rgba(20, 184, 166, 0.7)"
              ),
              borderRadius: 4,
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
                  // 0 = lo ofrece sin costo. Se nombra, no se pinta "$0.00",
                  // que en una columna de precios se lee como dato faltante.
                  return `${textoPrecioGanador(
                    fila.precioPromedio,
                    (v) => `$${fmt(v)} MXN`
                  )} · ${fila.cantidad.toLocaleString("es-MX")} unidades cotizadas`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `$${fmt(Number(v))}` },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        }}
      />
    </div>
  );
}
