"use client";

import {
  IconAdjustments,
  IconAlertCircle,
  IconChartBar,
  IconChevronDown,
  IconChevronUp,
  IconCoin,
  IconFileInvoice,
  IconTrendingDown,
  IconTruck,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { filtrosAQueryString, SIN_FAMILIA } from "@/src/lib/tableroFiltros";
import type { FiltrosActivos, TableroData } from "./types";
import { formatDuracionHoras } from "@/src/lib/tableroEtapas";
import GraficaAdherencia from "./GraficaAdherencia";
import GraficaPareto from "./GraficaPareto";
import GraficaRankingUnitario from "./GraficaRankingUnitario";
import GraficaTop3Proveedores from "./GraficaTop3Proveedores";
import GraficaVariacionPrecio from "./GraficaVariacionPrecio";
import SelectorPeriodo from "./SelectorPeriodo";
import GraficaAhorroMensual from "./GraficaAhorroMensual";
import GraficaOnTime from "./GraficaOnTime";
import GraficaPipelineCantidad from "./GraficaPipelineCantidad";
import GraficaPipelineTiempo from "./GraficaPipelineTiempo";
import GraficaPrecios from "./GraficaPrecios";
import GraficaSinOc from "./GraficaSinOc";
import GraficaTiempoEtapas from "./GraficaTiempoEtapas";
import { COLOR_CATEGORIA } from "./pipelineSeries";
import type { CategoriaLicitacion } from "@/src/lib/tableroCategorias";

function fmt(n: number) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${fmt(n)}`;
}

type SectionKey =
  | "precios"
  | "ahorro"
  | "ontime"
  | "adherencia"
  | "ahorroMensual"
  | "etapas"
  | "pipelineCantidad"
  | "pipelineTiempo"
  | "sinOc"
  | "histAhorro"
  | "histMonto"
  | "histTop3"
  | "histVariacion"
  | "histCosto";

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

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

  // El mapeo campo → parámetro de URL vive en tableroFiltros.ts, compartido con
  // el server. Antes esta lista estaba hardcodeada aquí y había que acordarse
  // de tocar los dos lados al agregar un filtro.
  function updateFilter(key: keyof FiltrosActivos, value: string) {
    const next: FiltrosActivos = { ...filtros, [key]: value };
    // Cambiar de familia invalida el producto elegido: uno de otra familia
    // dejaría el tablero vacío sin que se vea por qué.
    if (key === "familia") next.productoId = "";
    startTransition(() => {
      router.replace(
        `${basePath}/comprador/tablero?${filtrosAQueryString(next)}`
      );
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

  const {
    kpis,
    precioChart,
    historico,
    onTimeProveedor,
    adherenciaJerarquia,
    ahorroMensual,
    tiempoEtapas,
    pipeline,
  } = data;

  // La lista de productos se acota a la familia elegida para que el
  // desplegable no ofrezca combinaciones que dejarían el tablero vacío.
  const productosVisibles = filtros.familia
    ? data.productosOpciones.filter((p) =>
        filtros.familia === SIN_FAMILIA
          ? p.familia === null
          : p.familia === filtros.familia
      )
    : data.productosOpciones;

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
          aria-label="Proveedor"
          value={filtros.proveedorId}
          onChange={(e) => updateFilter("proveedorId", e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los proveedores</option>
          {data.proveedoresOpciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.inactivo ? `${p.nombre} (inactivo)` : p.nombre}
            </option>
          ))}
        </select>

        {/* Criticidad — el campo del modelo se llama `jerarquia` y toma
            Crítica/Alta/Media/Baja. Antes decía "Todas las categorías", que
            hacía pensar que filtraba por categoría de producto; la categoría
            real de producto es el filtro de Familia que sigue. */}
        <select
          aria-label="Criticidad"
          value={filtros.jerarquia}
          onChange={(e) => updateFilter("jerarquia", e.target.value)}
          className={selectClass}
        >
          <option value="">Toda la criticidad</option>
          {data.jerarquiasOpciones.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

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
          {data.hayProductosSinFamilia && (
            <option value={SIN_FAMILIA}>Sin familia</option>
          )}
        </select>

        <select
          aria-label="Producto"
          value={filtros.productoId}
          onChange={(e) => updateFilter("productoId", e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los productos</option>
          {productosVisibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} — {p.nombre}
            </option>
          ))}
        </select>

        {isPending && (
          <span className="text-xs text-zinc-400">Actualizando…</span>
        )}
      </div>

      {/* ── Aviso de tipos de cambio faltantes ────────────────────────────────
          Sin TC capturado, conversionMoneda cae a tasa 1 y los importes en
          moneda extranjera se suman como si fueran MXN: el total mostrado
          queda POR DEBAJO del real, y en silencio. */}
      {data.avisoTiposCambio.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">
              {data.avisoTiposCambio.length}{" "}
              {data.avisoTiposCambio.length === 1 ? "licitación" : "licitaciones"} sin
              tipo de cambio capturado.
            </span>{" "}
            Sus importes en moneda extranjera se están sumando como MXN, así que
            los totales están sub-reportados. Captura las tasas en cada
            licitación para corregirlo:{" "}
            <span className="font-mono text-xs">
              {data.avisoTiposCambio.slice(0, 8).join(", ")}
              {data.avisoTiposCambio.length > 8 &&
                ` y ${data.avisoTiposCambio.length - 8} más`}
            </span>
          </p>
        </div>
      )}

      {/* ── KPIs de valor (licitaciones ejecutadas) ───────────────────────────
          Las tres cuadran por construcción: ahorro = primera ronda − mejores
          precios, sobre el mismo universo y consolidado a MXN. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Valor total de compras — primera ronda"
          value={fmtShort(kpis.valorPrimeraRonda)}
          icon={<IconCoin className="h-5 w-5" />}
          color="blue"
          sublabel={`$${fmt(kpis.valorPrimeraRonda)} MXN · ${kpis.licitacionesEjecutadas} ejecutada${
            kpis.licitacionesEjecutadas === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          label="Valor total de compras — mejores precios"
          value={fmtShort(kpis.valorMejoresPrecios)}
          icon={<IconCoin className="h-5 w-5" />}
          color="teal"
          sublabel={`$${fmt(kpis.valorMejoresPrecios)} MXN`}
        />
        <KpiCard
          label="Ahorro total"
          value={fmtShort(kpis.ahorroTotal)}
          icon={<IconTrendingDown className="h-5 w-5" />}
          color="green"
          sublabel={
            kpis.valorPrimeraRonda > 0
              ? `${Math.round((kpis.ahorroTotal / kpis.valorPrimeraRonda) * 1000) / 10}% sobre primera ronda`
              : "Sin ofertas en el periodo"
          }
        />
      </div>

      {/* ── KPIs operativos ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Licitaciones totales"
          value={String(kpis.licitacionesTotales)}
          icon={<IconFileInvoice className="h-5 w-5" />}
          color="blue"
          sublabel={`${kpis.licitacionesEjecutadas} ya ejecutadas`}
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
          sublabel="Sobre OC entregadas con fecha objetivo"
        />
      </div>

      {/* ── Grupo 2: pipeline (estado actual) ─────────────────────────────────
          Este bloque NO respeta el filtro de periodo, a diferencia de todo lo
          demás en la pantalla. Se dice explícitamente en el encabezado porque
          si no, dos secciones con universos distintos se leen como un error. */}
      <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Pipeline de licitaciones
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Estado actual al día de hoy — no depende del filtro de periodo
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pipeline.categorias.map((cat) => (
            <PipelineTile
              key={cat.clave}
              label={cat.label}
              cantidad={cat.cantidad}
              tiempoHoras={cat.tiempoPromedioHoras}
              color={COLOR_CATEGORIA[cat.clave as CategoriaLicitacion]}
              nota={
                cat.clave === "terminadas" || cat.clave === "cancelada"
                  ? "ciclo completo"
                  : "en el estado"
              }
              atenuado={cat.clave === "cancelada"}
            />
          ))}
        </div>

        {/* Subconjunto de Terminadas, no una categoría más: va aparte para que
            nadie lo sume a los tiles de arriba. */}
        <div className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-800">
                Cerradas sin OC enviada
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-amber-900">
                {pipeline.sinOcEnviada.cantidad}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                {pipeline.sinOcEnviada.tiempoPromedioHoras !== null
                  ? `${formatDuracionHoras(pipeline.sinOcEnviada.tiempoPromedioHoras)} atoradas en promedio`
                  : "Sin órdenes pendientes"}
              </p>
            </div>
            <IconAlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          </div>
          <p className="mt-2 text-xs text-amber-700/80">
            Licitaciones finalizadas con orden de compra creada pero aún en
            &ldquo;Pendiente&rdquo;. Ya están contadas dentro de Terminadas.
          </p>
        </div>

        <p className="mt-3 text-xs text-zinc-400">
          Antigüedad calculada con la bitácora de estados en{" "}
          {pipeline.entradasExactas} de {pipeline.entradasTotales} licitaciones;
          el resto usa una fecha aproximada.
        </p>
      </div>

      {/* ── Pipeline: cantidad por mes ────────────────────────────────────────── */}
      <ChartSection
        title="Licitaciones por mes de entrada al estado actual"
        subtitle="Distribución de antigüedad — cuántas de las que hoy están en cada etapa entraron cada mes"
        hasData={pipeline.cantidadPorMes.length > 0}
        isOpen={openTables.has("pipelineCantidad")}
        onToggle={() => toggleTable("pipelineCantidad")}
      >
        <GraficaPipelineCantidad data={pipeline.cantidadPorMes} />
        {openTables.has("pipelineCantidad") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">Mes</th>
                  {pipeline.categorias.map((c) => (
                    <th key={c.clave} className="pb-2 pr-3 text-right">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {pipeline.cantidadPorMes.map((row) => (
                  <tr key={row.mes} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
                    {pipeline.categorias.map((c) => (
                      <td key={c.clave} className="py-1.5 pr-3 text-right">
                        {row.porCategoria[c.clave] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Pipeline: tiempo por mes ──────────────────────────────────────────── */}
      <ChartSection
        title="Tiempo promedio por mes y categoría"
        subtitle="Terminadas y Canceladas miden ciclo completo; el resto, antigüedad en el estado"
        hasData={pipeline.tiempoPorMes.length > 0}
        isOpen={openTables.has("pipelineTiempo")}
        onToggle={() => toggleTable("pipelineTiempo")}
      >
        <GraficaPipelineTiempo data={pipeline.tiempoPorMes} />
        {openTables.has("pipelineTiempo") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">Mes</th>
                  {pipeline.categorias.map((c) => (
                    <th key={c.clave} className="pb-2 pr-3 text-right">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {pipeline.tiempoPorMes.map((row) => (
                  <tr key={row.mes} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
                    {pipeline.categorias.map((c) => {
                      const v = row.porCategoria[c.clave];
                      return (
                        <td key={c.clave} className="py-1.5 pr-3 text-right">
                          {v != null ? formatDuracionHoras(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Cerradas sin OC enviada, por mes ──────────────────────────────────── */}
      <ChartSection
        title="Cerradas sin OC enviada, por mes"
        subtitle="Agrupadas por la fecha de la orden pendiente más antigua de cada licitación"
        hasData={pipeline.sinOcPorMes.length > 0}
        isOpen={openTables.has("sinOc")}
        onToggle={() => toggleTable("sinOc")}
      >
        <GraficaSinOc data={pipeline.sinOcPorMes} />
        {openTables.has("sinOc") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">Mes</th>
                  <th className="pb-2 pr-3 text-right">Licitaciones</th>
                  <th className="pb-2 text-right">Tiempo atorada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {pipeline.sinOcPorMes.map((row) => (
                  <tr key={row.mes} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
                    <td className="py-1.5 pr-3 text-right">{row.cantidad}</td>
                    <td className="py-1.5 text-right">
                      {row.tiempoPromedioHoras != null
                        ? formatDuracionHoras(row.tiempoPromedioHoras)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Ahorro por mes ────────────────────────────────────────────────────── */}
      <ChartSection
        title="Ahorro por mes"
        subtitle="Licitaciones ejecutadas, agrupadas por mes de cierre"
        hasData={ahorroMensual.length > 0}
        isOpen={openTables.has("ahorroMensual")}
        onToggle={() => toggleTable("ahorroMensual")}
      >
        <GraficaAhorroMensual data={ahorroMensual} />
        {openTables.has("ahorroMensual") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-4">Mes</th>
                  <th className="pb-2 text-right">Ahorro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ahorroMensual.map((row) => (
                  <tr key={row.mes} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-2 pr-4 font-medium">{row.etiqueta}</td>
                    <td className="py-2 text-right font-medium text-green-600">
                      ${fmt(row.ahorro)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

      {/* ── Tiempo promedio por etapa ─────────────────────────────────────────── */}
      <ChartSection
        title="Tiempo promedio por etapa"
        subtitle={`${tiempoEtapas.licitacionesUtilizables} de ${tiempoEtapas.licitacionesTotales} licitaciones con bitácora utilizable`}
        hasData={tiempoEtapas.etapas.length > 0}
        isOpen={openTables.has("etapas")}
        onToggle={() => toggleTable("etapas")}
      >
        <GraficaTiempoEtapas data={tiempoEtapas.etapas} />
        {/* Cobertura visible: un promedio sacado de 3 de 40 licitaciones se lee
            como si fuera de las 40 si no se dice lo contrario. */}
        <p className="mt-3 text-xs text-zinc-400">
          Calculado sobre {tiempoEtapas.licitacionesUtilizables} de{" "}
          {tiempoEtapas.licitacionesTotales} licitaciones ejecutadas — el resto no
          tiene bitácora de estados suficiente.
          {tiempoEtapas.intervalosDescartados > 0 && (
            <>
              {" "}
              Se descartaron {tiempoEtapas.intervalosDescartados} intervalo
              {tiempoEtapas.intervalosDescartados === 1 ? "" : "s"} por
              transiciones faltantes en el registro.
            </>
          )}
        </p>
        {openTables.has("etapas") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-4">Etapa</th>
                  <th className="pb-2 pr-4 text-right">Tiempo promedio</th>
                  <th className="pb-2 text-right">Licitaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {tiempoEtapas.etapas.map((row) => (
                  <tr key={row.etapa} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-2 pr-4 font-medium">{row.etapa}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatDuracionHoras(row.promedioHoras)}
                    </td>
                    <td className="py-2 text-right text-zinc-500">{row.licitaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartSection>

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


      {/* ── Grupo 3: análisis histórico ────────────────────────────────────────
          Cada gráfico de esta sección tiene su PROPIA ventana temporal; el
          filtro global de periodo no aplica aquí (los de familia, producto y
          proveedor sí). Se avisa en el encabezado porque, si no, tener cinco
          ventanas distintas en una pantalla se lee como incoherencia. */}
      <div className="rounded-[10px] border border-[#ede8e8] bg-surface-muted px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Análisis histórico</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Cada gráfico usa su propio periodo
          {historico.productoBloqueado &&
            " · el filtro global de producto está fijando los gráficos de un solo producto"}
        </p>
      </div>

      {/* #1 — Ahorro por producto (Pareto) */}
      <ChartSection
        title="Ahorro total por producto"
        subtitle="Primera ronda con puja − mejor precio, en MXN"
        hasData={historico.ahorroPorProducto.length > 0}
        isOpen={openTables.has("histAhorro")}
        onToggle={() => toggleTable("histAhorro")}
        control={
          <SelectorPeriodo
            ariaLabel="Periodo del ahorro por producto"
            valor={filtros.perAhorro}
            onChange={(v) => updateFilter("perAhorro", v)}
          />
        }
      >
        <GraficaPareto data={historico.ahorroPorProducto} etiquetaValor="Ahorro" />
        <TablaPareto
          filas={historico.ahorroPorProducto}
          encabezado="Producto"
          encabezadoValor="Ahorro"
          visible={openTables.has("histAhorro")}
        />
      </ChartSection>

      {/* #2 — Monto asignado por proveedor (Pareto) */}
      <ChartSection
        title="Monto asignado por proveedor"
        subtitle="Lo realmente comprado (asignaciones, sin las rechazadas) — no cuadra con «Valor mejores precios», que mide otra cosa"
        hasData={historico.montoPorProveedor.length > 0}
        isOpen={openTables.has("histMonto")}
        onToggle={() => toggleTable("histMonto")}
        control={
          <SelectorPeriodo
            ariaLabel="Periodo del monto por proveedor"
            valor={filtros.perMonto}
            onChange={(v) => updateFilter("perMonto", v)}
          />
        }
      >
        <GraficaPareto
          data={historico.montoPorProveedor}
          etiquetaValor="Monto asignado"
        />
        {historico.proveedorFiltrado && historico.montoPorProveedor.length <= 1 && (
          <p className="mt-3 text-xs text-amber-600">
            Solo se ve un proveedor porque el filtro global de proveedor está
            activo. Quítalo para comparar contra el resto.
          </p>
        )}
        <TablaPareto
          filas={historico.montoPorProveedor}
          encabezado="Proveedor"
          encabezadoValor="Monto asignado"
          visible={openTables.has("histMonto")}
        />
      </ChartSection>

      {/* #3 y #5 — indicadores de un solo producto */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSection
          title="Top 3 proveedores por producto"
          subtitle="Mejor precio unitario promedio — incluye a quienes cotizaron y no ganaron"
          hasData={historico.top3Proveedores.length > 0}
          isOpen={openTables.has("histTop3")}
          onToggle={() => toggleTable("histTop3")}
          control={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SelectorProducto
                ariaLabel="Producto del top 3"
                valor={historico.productoTop3}
                opciones={historico.productosOpciones}
                bloqueado={historico.productoBloqueado}
                onChange={(v) => updateFilter("prodTop3", v)}
              />
              <SelectorPeriodo
                ariaLabel="Periodo del top 3"
                valor={filtros.perTop3}
                onChange={(v) => updateFilter("perTop3", v)}
              />
            </div>
          }
        >
          <GraficaTop3Proveedores data={historico.top3Proveedores} />
          {openTables.has("histTop3") && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2 pr-3">Proveedor</th>
                    <th className="pb-2 pr-3 text-right">Precio unitario prom.</th>
                    <th className="pb-2 text-right">Unidades cotizadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {historico.top3Proveedores.map((row) => (
                    <tr key={row.proveedorId} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="py-1.5 pr-3 font-medium">{row.proveedorNombre}</td>
                      <td className="py-1.5 pr-3 text-right">${fmt(row.precioPromedio)}</td>
                      <td className="py-1.5 text-right text-zinc-500">
                        {row.cantidad.toLocaleString("es-MX")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartSection>

        <ChartSection
          title="Variación de precios por producto"
          subtitle="Costo unitario promedio pagado, mes a mes"
          hasData={historico.variacionPrecio.some((v) => v.precioPromedio != null)}
          isOpen={openTables.has("histVariacion")}
          onToggle={() => toggleTable("histVariacion")}
          control={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SelectorProducto
                ariaLabel="Producto de la variación"
                valor={historico.productoVariacion}
                opciones={historico.productosOpciones}
                bloqueado={historico.productoBloqueado}
                onChange={(v) => updateFilter("prodVariacion", v)}
              />
              <SelectorPeriodo
                ariaLabel="Periodo de la variación"
                valor={filtros.perVariacion}
                onChange={(v) => updateFilter("perVariacion", v)}
              />
            </div>
          }
        >
          <GraficaVariacionPrecio data={historico.variacionPrecio} />
          {openTables.has("histVariacion") && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2 pr-3">Mes</th>
                    <th className="pb-2 pr-3 text-right">Costo unitario prom.</th>
                    <th className="pb-2 text-right">Unidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {historico.variacionPrecio.map((row) => (
                    <tr key={row.mes} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {row.precioPromedio != null ? `$${fmt(row.precioPromedio)}` : "—"}
                      </td>
                      <td className="py-1.5 text-right text-zinc-500">
                        {row.cantidad.toLocaleString("es-MX")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartSection>
      </div>

      {/* #4 — Costo unitario promedio (ranking, SIN acumulado) */}
      <ChartSection
        title="Costo unitario promedio por producto"
        subtitle="Ponderado por cantidad. Ranking sin acumulado: los precios unitarios no se suman entre productos"
        hasData={historico.costoUnitario.length > 0}
        isOpen={openTables.has("histCosto")}
        onToggle={() => toggleTable("histCosto")}
        control={
          <SelectorPeriodo
            ariaLabel="Periodo del costo unitario"
            valor={filtros.perCosto}
            onChange={(v) => updateFilter("perCosto", v)}
          />
        }
      >
        <GraficaRankingUnitario data={historico.costoUnitario} />
        {openTables.has("histCosto") && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">Producto</th>
                  <th className="pb-2 pr-3">Unidad</th>
                  <th className="pb-2 text-right">Costo unitario prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {historico.costoUnitario.map((row) => (
                  <tr key={row.productoId} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
                    <td className="py-1.5 pr-3 text-zinc-500">{row.unidad.trim() || "—"}</td>
                    <td className="py-1.5 text-right">${fmt(row.precioPromedio)}</td>
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
                    <th className="pb-2 pr-3 text-right">OC medibles</th>
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
          title="Adherencia de precios por criticidad"
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
                    <th className="pb-2 pr-3">Criticidad</th>
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

/**
 * Tile del pipeline: cantidad y tiempo promedio juntos. Van en una sola pieza
 * y no en dos tarjetas porque son la misma historia — "cuántas hay aquí y
 * cuánto llevan"; separarlas duplicaba el ruido sin agregar información.
 */
function PipelineTile({
  label,
  cantidad,
  tiempoHoras,
  color,
  nota,
  atenuado,
}: {
  label: string;
  cantidad: number;
  tiempoHoras: number | null;
  color: string;
  nota: string;
  atenuado?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border border-[#ede8e8] bg-white p-4 ${
        atenuado ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <p className="truncate text-xs font-medium text-zinc-500">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900">
        {cantidad}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">
        {tiempoHoras !== null
          ? `${formatDuracionHoras(tiempoHoras)} ${nota}`
          : "Sin dato de tiempo"}
      </p>
    </div>
  );
}

/** Tabla de detalle compartida por los dos Paretos (ahorro y monto). */
function TablaPareto({
  filas,
  encabezado,
  encabezadoValor,
  visible,
}: {
  filas: { id: string; etiqueta: string; valor: number; porcentajeAcumulado: number }[];
  encabezado: string;
  encabezadoValor: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
            <th className="pb-2 pr-3">{encabezado}</th>
            <th className="pb-2 pr-3 text-right">{encabezadoValor}</th>
            <th className="pb-2 text-right">% acumulado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {filas.map((row) => (
            <tr key={row.id} className="text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150">
              <td className="py-1.5 pr-3 font-medium">{row.etiqueta}</td>
              <td className="py-1.5 pr-3 text-right">${fmt(row.valor)}</td>
              <td className="py-1.5 text-right text-zinc-500">
                {row.porcentajeAcumulado}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Selector de producto de los indicadores de un solo producto (#3 y #5).
 * Se deshabilita cuando el filtro global de producto está activo: ese filtro
 * manda, y dejarlo editable permitiría pedir un producto que el filtro global
 * ya excluyó.
 */
function SelectorProducto({
  valor,
  opciones,
  bloqueado,
  onChange,
  ariaLabel,
}: {
  valor: string;
  opciones: { id: string; codigo: string; nombre: string }[];
  bloqueado: boolean;
  onChange: (valor: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={valor}
      disabled={bloqueado}
      title={bloqueado ? "Fijado por el filtro global de producto" : undefined}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[13rem] truncate rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
    >
      {opciones.length === 0 && <option value="">Sin productos con compras</option>}
      {opciones.map((p) => (
        <option key={p.id} value={p.id}>
          {p.codigo} — {p.nombre}
        </option>
      ))}
    </select>
  );
}

function ChartSection({
  title,
  subtitle,
  hasData,
  isOpen,
  onToggle,
  control,
  children,
}: {
  title: string;
  subtitle?: string;
  hasData: boolean;
  isOpen: boolean;
  onToggle: () => void;
  /** Controles propios de la gráfica (periodo, producto) — Grupo 3. */
  control?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
        </div>
        {control}
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
