"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// ⚠️ Blindaje pg/util-types: igual que AhorroMensualChart, este archivo es
// "use client" y solo puede importar del módulo PURO. dashboardQueries.ts
// arrastra prisma → pg → node:util y no puede aparecer aquí ni como
// `import type`.
import {
  formatMonto,
  formatMontoCorto,
  type PuntoTopProveedor,
} from "@/src/lib/dashboardTypes";

const ANCHO_EJE = 190;
const MAX_CARACTERES = 22;

function acortar(nombre: string): string {
  return nombre.length > MAX_CARACTERES
    ? `${nombre.slice(0, MAX_CARACTERES - 1).trimEnd()}…`
    : nombre;
}

type TickProps = { x?: number; y?: number; payload?: { value?: string } };

/**
 * Etiqueta del eje de nombres, en UNA sola línea siempre.
 *
 * El tick por defecto de recharts envuelve el texto cuando no cabe en `width`,
 * y entonces la etiqueta se parte en dos renglones y deja de estar centrada
 * contra su barra. Recortar a N caracteres no lo evita del todo: el ancho real
 * depende de qué caracteres sean ("MM" mide casi el doble que "ll"), así que
 * calibrar el corte contra los píxeles funciona para unos nombres y falla para
 * otros. Un <text> propio no envuelve nunca, con cualquier razón social.
 */
function TickNombre({ x = 0, y = 0, payload }: TickProps) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="#71717a">
      {acortar(payload?.value ?? "")}
    </text>
  );
}

function TooltipProveedor({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PuntoTopProveedor }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="rounded-[10px] border border-border bg-white px-3 py-2 shadow-card">
      {/* La razón social completa: el eje la trunca, aquí se ve entera. */}
      <p className="max-w-[240px] text-xs font-semibold text-zinc-800">{p.nombre}</p>
      <p className="mt-1 text-xs text-zinc-600">
        {formatMonto(p.montoMXN)} <span className="text-zinc-400">MXN adjudicados</span>
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-400">
        Ganó {p.licitacionesGanadas} de {p.licitacionesParticipadas}{" "}
        {p.licitacionesParticipadas === 1 ? "licitación" : "licitaciones"} en las que
        ofertó
      </p>
    </div>
  );
}

export default function TopProveedoresChart({
  data,
}: {
  data: PuntoTopProveedor[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-zinc-500">Todavía no hay nada adjudicado</p>
        <p className="max-w-xs text-xs text-zinc-400">
          El ranking aparece cuando se asignan materiales a un proveedor.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* layout="vertical" = barras HORIZONTALES. Es lo que permite leer
            razones sociales de hasta 48 caracteres; en barras verticales las
            etiquetas quedarían rotadas e ilegibles. */}
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap="22%"
          margin={{ top: 4, right: 64, left: 0, bottom: 0 }}
        >
          <defs>
            {/* Mismo degradado del primario que AhorroMensualChart, rotado a
                horizontal para que acompañe la dirección de la barra. */}
            <linearGradient id="gradProveedor" x1="0" y1="0" x2="1" y2="0">
              <stop
                offset="0%"
                stopColor="var(--color-primario, #004439)"
                stopOpacity={0.95}
              />
              <stop
                offset="100%"
                stopColor="var(--color-primario, #004439)"
                stopOpacity={0.55}
              />
            </linearGradient>
          </defs>

          <CartesianGrid horizontal={false} stroke="#ede8e8" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(valor: number) => formatMontoCorto(valor)}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={<TickNombre />}
            axisLine={false}
            tickLine={false}
            width={ANCHO_EJE}
            // interval={0} = pinta TODAS las etiquetas. Con el default,
            // recharts esconde una sí y otra no en cuanto el alto aprieta
            // (pasa en móvil) y quedan barras anónimas, que es peor que
            // apretadas: sin nombre, la barra no dice nada.
            interval={0}
          />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} content={<TooltipProveedor />} />
          <Bar
            dataKey="montoMXN"
            fill="url(#gradProveedor)"
            radius={[0, 6, 6, 0]}
            maxBarSize={34}
          >
            <LabelList
              dataKey="montoMXN"
              position="right"
              offset={8}
              className="fill-zinc-500"
              fontSize={11}
              // El tipo de recharts admite texto/undefined, no solo number.
              formatter={(valor: unknown) => formatMontoCorto(Number(valor) || 0)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
