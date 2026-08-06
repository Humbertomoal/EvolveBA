"use client";

import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCoin,
  IconDiscount2,
  IconFileInvoice,
  IconTrendingDown,
  IconTrophy,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { filtrosAQueryString, SIN_FAMILIA } from "@/src/lib/tableroFiltros";
// Gráficas genéricas reutilizadas del tablero del comprador: reciben sus datos
// por props y no saben nada del dominio, así que sirven igual de este lado.
import GraficaPareto from "@/app/[codigoCliente]/comprador/tablero/_components/GraficaPareto";
import GraficaVariacionPrecio from "@/app/[codigoCliente]/comprador/tablero/_components/GraficaVariacionPrecio";
import GraficaRankingSimple from "./GraficaRankingSimple";
import type { DesempenoData, FiltrosDesempeno } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

type SectionKey = "variacion" | "cantidad" | "monto" | "sobreMonto" | "sobrePct";

export default function DesempenoView({
  data,
  filtros,
  basePath,
}: {
  data: DesempenoData;
  filtros: FiltrosDesempeno;
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abiertas, setAbiertas] = useState<Set<SectionKey>>(new Set());

  function updateFilter(key: keyof FiltrosDesempeno, value: string) {
    const next: FiltrosDesempeno = { ...filtros, [key]: value };
    if (key === "familia") next.productoId = "";
    // `proveedorId` nunca viaja en la URL: el servidor lo fija desde la sesión.
    next.proveedorId = "";
    startTransition(() => {
      router.replace(`${basePath}/proveedor/desempeno?${filtrosAQueryString(next)}`);
    });
  }

  function toggle(k: SectionKey) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const { kpis, sobrecostoResumen } = data;

  const productosVariacion =
    data.productosVendidos.length > 0 ? data.productosVendidos : data.productosOpciones;

  return (
    <div
      className={`space-y-6 transition-opacity ${isPending ? "pointer-events-none opacity-50" : ""}`}
    >
      {data.esImpersonacion && (
        <div className="rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          Viendo el desempeño de <strong>{data.proveedorNombre}</strong> en modo prueba.
        </div>
      )}

      {/* ── Filtros (sin selector de proveedor: es él mismo) ──────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#ede8e8] bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
        <span className="text-xs font-medium text-zinc-400">Filtros</span>

        <select
          aria-label="Periodo"
          value={filtros.period}
          onChange={(e) => updateFilter("period", e.target.value)}
          className={selectClass}
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
              aria-label="Desde"
              value={filtros.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className={selectClass}
            />
            <span className="text-xs text-zinc-400">hasta</span>
            <input
              type="date"
              aria-label="Hasta"
              value={filtros.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className={selectClass}
            />
          </>
        )}

        <select
          aria-label="Familia"
          value={filtros.familia}
          onChange={(e) => updateFilter("familia", e.target.value)}
          className={selectClass}
        >
          <option value="">Todas las familias</option>
          {data.familiasOpciones.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
          {data.hayProductosSinFamilia && <option value={SIN_FAMILIA}>Sin familia</option>}
        </select>

        <select
          aria-label="Producto"
          value={filtros.productoId}
          onChange={(e) => updateFilter("productoId", e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los productos</option>
          {data.productosOpciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} — {p.nombre}
            </option>
          ))}
        </select>

        {isPending && <span className="text-xs text-zinc-400">Actualizando…</span>}
      </div>

      {/* ── Participación y conversión (1-4) ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Licitaciones en las que participaste"
          value={String(kpis.participadas)}
          sub={`${kpis.invitadas} invitaciones recibidas`}
          icon={<IconFileInvoice className="h-5 w-5" />}
          color="blue"
        />
        <Kpi
          label="Licitaciones con venta"
          value={String(kpis.ganadas)}
          sub="Se te asignó al menos un material"
          icon={<IconTrophy className="h-5 w-5" />}
          color="green"
        />
        <Kpi
          label="% de licitaciones con venta"
          value={kpis.tasaConversion !== null ? `${kpis.tasaConversion}%` : "—"}
          sub="Sobre las que ofertaste"
          icon={<IconDiscount2 className="h-5 w-5" />}
          color="teal"
        />
        <Kpi
          label="Monto total de venta"
          value={fmtShort(kpis.montoVenta)}
          sub={`$${fmt(kpis.montoVenta)} MXN`}
          icon={<IconCoin className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* ── Ahorro que concediste (5-7) ───────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Monto a tu precio de primera ronda"
          value={fmtShort(kpis.montoPrimeraRonda)}
          sub="Lo ganado, valuado a tu primera oferta"
          icon={<IconCoin className="h-5 w-5" />}
          color="blue"
        />
        <Kpi
          label="Monto a precio final vendido"
          value={fmtShort(kpis.montoMejorPrecio)}
          sub="Igual al monto total de venta"
          icon={<IconCoin className="h-5 w-5" />}
          color="teal"
        />
        <Kpi
          label="Ahorro que generaste"
          value={fmtShort(kpis.ahorroGenerado)}
          sub={
            kpis.montoPrimeraRonda > 0
              ? `${Math.round((kpis.ahorroGenerado / kpis.montoPrimeraRonda) * 1000) / 10}% de concesión`
              : "Sin ofertas en el periodo"
          }
          icon={<IconTrendingDown className="h-5 w-5" />}
          color="amber"
        />
      </div>

      {/* ── 8. Variación de precios ───────────────────────────────────────────── */}
      <Seccion
        titulo="Variación de tus precios por producto"
        subtitulo="Precio unitario promedio al que vendiste, mes a mes"
        hayDatos={data.variacionPrecio.some((v) => v.precioPromedio != null)}
        abierta={abiertas.has("variacion")}
        onToggle={() => toggle("variacion")}
        control={
          <select
            aria-label="Producto de la variación"
            value={data.productoVariacion}
            disabled={Boolean(filtros.productoId)}
            title={filtros.productoId ? "Fijado por el filtro de producto" : undefined}
            onChange={(e) => updateFilter("prodVariacion", e.target.value)}
            className={`${selectClass} max-w-[15rem] truncate text-xs disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400`}
          >
            {productosVariacion.length === 0 && <option value="">Sin ventas</option>}
            {productosVariacion.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
        }
      >
        <GraficaVariacionPrecio data={data.variacionPrecio} />
      </Seccion>

      {/* ── 9 y 10. Productos vendidos ────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion
          titulo="Productos que más vendiste — cantidad"
          subtitulo="Ranking sin acumulado: las unidades de medida no son comparables entre productos"
          hayDatos={data.cantidadPorProducto.length > 0}
          abierta={abiertas.has("cantidad")}
          onToggle={() => toggle("cantidad")}
        >
          <GraficaRankingSimple
            color="rgba(20, 184, 166, 0.8)"
            data={data.cantidadPorProducto.map((p) => ({
              id: p.productoId,
              etiqueta: p.etiqueta,
              valor: p.cantidad,
              nota: p.unidad.trim() || "unidades",
            }))}
            formatValor={(v, fila) => `${v.toLocaleString("es-MX")} ${fila.nota}`}
          />
        </Seccion>

        <Seccion
          titulo="Productos que más vendiste — monto"
          subtitulo="Pareto: qué pocos productos concentran tu facturación"
          hayDatos={data.montoPorProducto.length > 0}
          abierta={abiertas.has("monto")}
          onToggle={() => toggle("monto")}
        >
          <GraficaPareto data={data.montoPorProducto} etiquetaValor="Monto vendido" />
        </Seccion>
      </div>

      {/* ── 11 y 12. Sobrecosto en lo que perdiste ────────────────────────────── */}
      <div className="rounded-[10px] border border-[#ede8e8] bg-surface-muted px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          Sobrecosto en licitaciones que no ganaste
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Cuánto más caro que el precio adjudicado quedó tu mejor oferta, en los
          materiales donde cotizaste y no ganaste
        </p>
        {sobrecostoResumen.perdidosTotal > 0 && (
          <p className="mt-2 text-xs text-zinc-600">
            {sobrecostoResumen.perdidosTotal} materiales analizados · sobrecosto total{" "}
            <strong>${fmt(sobrecostoResumen.totalMXN)} MXN</strong>
            {sobrecostoResumen.perdidosMasBaratos > 0 && (
              <>
                {" · "}
                <span className="text-amber-700">
                  en {sobrecostoResumen.perdidosMasBaratos} ofertaste más barato y aun
                  así no ganaste
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion
          titulo="Sobrecosto por producto — monto"
          subtitulo="Pareto: dónde se concentra el dinero que dejaste sobre la mesa"
          hayDatos={data.sobrecostoMonto.length > 0}
          abierta={abiertas.has("sobreMonto")}
          onToggle={() => toggle("sobreMonto")}
        >
          <GraficaPareto data={data.sobrecostoMonto} etiquetaValor="Sobrecosto" />
        </Seccion>

        <Seccion
          titulo="Sobrecosto por producto — %"
          subtitulo="Ranking sin acumulado: los porcentajes no se suman entre productos"
          hayDatos={data.sobrecostoPct.length > 0}
          abierta={abiertas.has("sobrePct")}
          onToggle={() => toggle("sobrePct")}
        >
          <GraficaRankingSimple
            color="rgba(239, 68, 68, 0.75)"
            data={data.sobrecostoPct.map((p) => ({
              id: p.productoId,
              etiqueta: p.etiqueta,
              valor: p.porcentaje,
              nota: `${p.materiales} material${p.materiales === 1 ? "" : "es"}`,
            }))}
            formatValor={(v, fila) => `${v}% más caro · ${fila.nota}`}
          />
        </Seccion>
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "teal" | "amber";
}) {
  const s = {
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
    green: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-500" },
    teal: { bg: "bg-teal-50", text: "text-teal-700", icon: "text-teal-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
  }[color];

  return (
    <div className="rounded-[10px] border border-[#ede8e8] bg-white p-5 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={`mt-1.5 truncate text-2xl font-bold tracking-tight ${s.text}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
        </div>
        <div className={`shrink-0 rounded-lg p-2 ${s.bg} ${s.icon}`}>{icon}</div>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  subtitulo,
  hayDatos,
  abierta,
  onToggle,
  control,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  hayDatos: boolean;
  abierta: boolean;
  onToggle: () => void;
  control?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-[#ede8e8] bg-white p-5 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-zinc-400">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-2">
          {control}
          {hayDatos && (
            <button
              type="button"
              onClick={onToggle}
              className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
            >
              {abierta ? (
                <><IconChevronUp className="h-3.5 w-3.5" />Ocultar</>
              ) : (
                <><IconChevronDown className="h-3.5 w-3.5" />Ampliar</>
              )}
            </button>
          )}
        </div>
      </div>
      {hayDatos ? (
        children
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12 text-sm text-zinc-400">
          <IconAlertCircle className="h-4 w-4 shrink-0" />
          Sin datos para el periodo seleccionado
        </div>
      )}
    </div>
  );
}
