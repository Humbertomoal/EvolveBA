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

/**
 * Serie única en ámbar. No reutiliza GraficaPipelineCantidad porque aquí no hay
 * categorías que apilar: "sin OC enviada" es un subconjunto de Terminadas, y
 * meterlo en la apilada del pipeline contaría dos veces las mismas licitaciones.
 */
export default function GraficaSinOc({
  data,
}: {
  data: {
    mes: string;
    etiqueta: string;
    cantidad: number;
    tiempoPromedioHoras: number | null;
  }[];
}) {
  const chartData = {
    labels: data.map((d) => d.etiqueta),
    datasets: [
      {
        label: "Licitaciones",
        data: data.map((d) => d.cantidad),
        backgroundColor: "rgba(245, 158, 11, 0.8)",
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
                  const fila = data[ctx.dataIndex];
                  const tiempo =
                    fila.tiempoPromedioHoras != null
                      ? ` · ${formatDuracionHoras(fila.tiempoPromedioHoras)} atoradas`
                      : "";
                  return `${fila.cantidad} licitacion${fila.cantidad === 1 ? "" : "es"}${tiempo}`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
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
