"use client";

import {
  IconAdjustments,
  IconAlertCircle,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconCoin,
  IconFileInvoice,
  IconTruck,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FiltrosActivos, TableroData } from "./types";
import GraficaAdherencia from "./GraficaAdherencia";
import GraficaAhorro from "./GraficaAhorro";
import GraficaOnTime from "./GraficaOnTime";
import GraficaPrecios from "./GraficaPrecios";

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

type SectionKey = "precios" | "ahorro" | "ontime" | "adherencia";

export default function TableroView({
  data,
  filtros,
  basePath,
}: {
  data: TableroData;
  filtros: FiltrosActivos;
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openTables, setOpenTables] = useState<Set<SectionKey>>(new Set());

  function updateFilter(key: string, value: string) {
    const raw: Record<string, string> = {
      period: filtros.period,
      proveedor: filtros.proveedorId,
      jerarquia: filtros.jerarquia,
      dateFrom: filtros.dateFrom,
      dateTo: filtros.dateTo,
      [key]: value,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) {
      if (v) params.set(k, v);
    }
    startTransition(() => {
      router.replace(`${basePath}/comprador/tablero?${params.toString()}`);
    });
  }

  function toggleTable(key: SectionKey) {
    setOpenTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const { kpis, precioChart, ahorroMaterial, onTimeProveedor, adherenciaJerarquia } = data;

  return (
    <div className={`space-y-6 transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <IconAdjustments className="h-4 w-4" />
          Filtros
        </div>

        <select
          value={filtros.period}
          onChange={(e) => updateFilter("period", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="last_week">Última semana</option>
          <option value="last_month">Último mes</option>
          <option value="last_3_months">Últimos 3 meses</option>
          <option value="custom">Rango personalizado</option>
        </select>

        {filtros.period === "custom" && (
          <>
            <input
              type="date"
              value={filtros.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-zinc-400">hasta</span>
            <input
              type="date"
              value={filtros.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </>
        )}

        <select
          value={filtros.proveedorId}
          onChange={(e) => updateFilter("proveedor", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos los proveedores</option>
          {data.proveedoresOpciones.map((p: any)=> (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        <select
          value={filtros.jerarquia}
          onChange={(e) => updateFilter("jerarquia", e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todas las categorías</option>
          {data.jerarquiasOpciones.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

        {isPending && (
          <span className="text-xs text-zinc-400">Actualizando…</span>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Licitaciones totales"
          value={String(kpis.licitacionesTotales)}
          icon={<IconFileInvoice className="h-5 w-5" />}
          color="blue"
        />
        <KpiCard
          label="Ahorro total generado"
          value={fmtShort(kpis.ahorroTotal)}
          icon={<IconCoin className="h-5 w-5" />}
          color="green"
          sublabel={kpis.ahorroTotal > 0 ? `$${fmt(kpis.ahorroTotal)} MXN` : "Sin asignaciones"}
        />
        <KpiCard
          label="Adherencia de precios"
          value={kpis.adherenciaPrecios !== null ? `${kpis.adherenciaPrecios}%` : "—"}
          icon={<IconChartBar className="h-5 w-5" />}
          color="teal"
          sublabel="Items dentro de objetivo"
        />
        <KpiCard
          label="On-time delivery"
          value={kpis.onTimeDelivery !== null ? `${kpis.onTimeDelivery}%` : "—"}
          icon={<IconTruck className="h-5 w-5" />}
          color={
            kpis.onTimeDelivery === null || kpis.onTimeDelivery >= 90 ? "green" : "amber"
          }
          sublabel="Órdenes entregadas a tiempo"
        />
      </div>

      {/* ── Gráfica 1: Precio inicial vs final ───────────────────────────────── */}
      <ChartSection
        title="Precio inicial vs precio final por licitación"
        hasData={precioChart.length > 0}
        isOpen={openTables.has("precios")}
        onToggle={() => toggleTable("precios")}
      >
        <GraficaPrecios data={precioChart} />
        {openTables.has("precios") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-4">Licitación</th>
                  <th className="pb-2 pr-4">Criticidad</th>
                  <th className="pb-2 pr-4 text-right">Precio inicial</th>
                  <th className="pb-2 pr-4 text-right">Precio final</th>
                  <th className="pb-2 pr-4 text-right">Ahorro $</th>
                  <th className="pb-2 text-right">Ahorro %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {precioChart.map((row) => (
                  <tr key={row.numero} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-2 pr-4 font-medium">{row.numero}</td>
                    <td className="py-2 pr-4 text-zinc-500">{row.jerarquia ?? "—"}</td>
                    <td className="py-2 pr-4 text-right">${fmt(row.precioInicial)}</td>
                    <td className="py-2 pr-4 text-right">${fmt(row.precioFinal)}</td>
                    <td className="py-2 pr-4 text-right font-medium text-green-600">${fmt(row.ahorro)}</td>
                    <td className="py-2 text-right font-medium text-green-600">{row.ahorroPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Gráfica 2: Ahorro por material ───────────────────────────────────── */}
      <ChartSection
        title="Ahorro por material"
        hasData={ahorroMaterial.length > 0}
        isOpen={openTables.has("ahorro")}
        onToggle={() => toggleTable("ahorro")}
      >
        <GraficaAhorro data={ahorroMaterial} />
        {openTables.has("ahorro") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-4">Material</th>
                  <th className="pb-2 pr-4">Categoría</th>
                  <th className="pb-2 pr-4 text-right">Cantidad total</th>
                  <th className="pb-2 pr-4 text-right">P. objetivo prom.</th>
                  <th className="pb-2 pr-4 text-right">P. adjudicado prom.</th>
                  <th className="pb-2 text-right">Ahorro total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ahorroMaterial.map((row) => (
                  <tr key={row.productoNombre} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-2 pr-4 font-medium">{row.productoNombre}</td>
                    <td className="py-2 pr-4 text-zinc-500">{row.familia ?? "—"}</td>
                    <td className="py-2 pr-4 text-right">{row.cantidadTotal.toLocaleString("es-MX")}</td>
                    <td className="py-2 pr-4 text-right">${fmt(row.precioObjetivoPromedio)}</td>
                    <td className="py-2 pr-4 text-right">${fmt(row.precioAdjudicadoPromedio)}</td>
                    <td className="py-2 text-right font-medium text-green-600">${fmt(row.ahorroTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Gráficas 3 y 4 en grid ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSection
          title="On-time delivery por proveedor"
          hasData={onTimeProveedor.length > 0}
          isOpen={openTables.has("ontime")}
          onToggle={() => toggleTable("ontime")}
        >
          <GraficaOnTime data={onTimeProveedor} />
          {openTables.has("ontime") && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2 pr-3">Proveedor</th>
                    <th className="pb-2 pr-3 text-right">Total OC</th>
                    <th className="pb-2 pr-3 text-right">A tiempo</th>
                    <th className="pb-2 pr-3 text-right">Tardías</th>
                    <th className="pb-2 text-right">% On-time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {onTimeProveedor.map((row) => (
                    <tr key={row.proveedorNombre} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="py-1.5 pr-3 font-medium">{row.proveedorNombre}</td>
                      <td className="py-1.5 pr-3 text-right">{row.totalOC}</td>
                      <td className="py-1.5 pr-3 text-right text-green-600">{row.aTiempo}</td>
                      <td className="py-1.5 pr-3 text-right text-red-500">{row.tardias}</td>
                      <td className={`py-1.5 text-right font-medium ${row.porcentaje >= 90 ? "text-green-600" : "text-red-500"}`}>
                        {row.porcentaje}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartSection>

        <ChartSection
          title="Adherencia de precios por categoría"
          hasData={adherenciaJerarquia.length > 0}
          isOpen={openTables.has("adherencia")}
          onToggle={() => toggleTable("adherencia")}
        >
          <GraficaAdherencia data={adherenciaJerarquia} />
          {openTables.has("adherencia") && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2 pr-3">Categoría</th>
                    <th className="pb-2 pr-3 text-right">Licitaciones</th>
                    <th className="pb-2 pr-3 text-right">Dentro obj.</th>
                    <th className="pb-2 pr-3 text-right">Fuera obj.</th>
                    <th className="pb-2 text-right">% Adherencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {adherenciaJerarquia.map((row) => (
                    <tr key={row.jerarquia} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="py-1.5 pr-3 font-medium">{row.jerarquia}</td>
                      <td className="py-1.5 pr-3 text-right">{row.licitaciones}</td>
                      <td className="py-1.5 pr-3 text-right text-green-600">{row.itemsDentro}</td>
                      <td className="py-1.5 pr-3 text-right text-red-500">{row.itemsFuera}</td>
                      <td className={`py-1.5 text-right font-medium ${row.porcentaje >= 80 ? "text-green-600" : "text-amber-600"}`}>
                        {row.porcentaje}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartSection>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  sublabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "teal" | "amber";
  sublabel?: string;
}) {
  const styles = {
    blue:  { bg: "bg-blue-50",   text: "text-blue-700",   icon: "text-blue-500"   },
    green: { bg: "bg-green-50",  text: "text-green-700",  icon: "text-green-500"  },
    teal:  { bg: "bg-teal-50",   text: "text-teal-700",   icon: "text-teal-500"   },
    amber: { bg: "bg-amber-50",  text: "text-amber-700",  icon: "text-amber-500"  },
  }[color];

  return (
    <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={`mt-1.5 truncate text-2xl font-bold tracking-tight ${styles.text}`}>{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-zinc-400">{sublabel}</p>}
        </div>
        <div className={`shrink-0 rounded-lg p-2 ${styles.bg} ${styles.icon}`}>{icon}</div>
      </div>
    </div>
  );
}

function ChartSection({
  title,
  hasData,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  hasData: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {hasData && (
          <button
            type="button"
            onClick={onToggle}
            className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            {isOpen ? (
              <><IconChevronUp className="h-3.5 w-3.5" />Ocultar detalle</>
            ) : (
              <><IconChevronDown className="h-3.5 w-3.5" />Ver detalle</>
            )}
          </button>
        )}
      </div>
      {hasData ? (
        children
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12 text-sm text-zinc-400">
          <IconAlertCircle className="h-4 w-4 shrink-0" />
          Sin datos suficientes para el período seleccionado
        </div>
      )}
    </div>
  );
}
