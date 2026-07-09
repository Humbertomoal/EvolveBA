"use client";

import { IconChartBar, IconClock, IconEye } from "@tabler/icons-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import PanelFiltros from "@/app/_components/PanelFiltros";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import { buscarSeleccionAction } from "@/src/lib/seleccionActions";
import {
  FILTROS_SELECCION_DEFAULT,
  type FiltrosSeleccion,
  type LicitacionSeleccion,
} from "@/src/lib/seleccionTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatPeso(n: number | null): string {
  if (n === null || n === 0) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatMoneda(n: number, moneda: string): string {
  try {
    return n.toLocaleString("es-MX", { style: "currency", currency: moneda });
  } catch {
    return formatPeso(n);
  }
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// Para ahorro: positivo (se ahorró dinero) = verde.
function ahorroColorClass(n: number | null): string {
  if (n == null) return "text-zinc-400";
  if (n === 0) return "text-zinc-500";
  return n > 0 ? "text-emerald-600" : "text-red-600";
}

function adherenciaBadgeClass(pct: number): string {
  if (pct >= 100) return "bg-emerald-100 text-emerald-700";
  if (pct >= 90) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

const ESTADO_VARIANT: Record<string, BadgeVariant> = {
  Cerrada: "neutral",
  Finalizada: "finalizada",
  Cancelada: "cancelada",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeleccionTabla({
  initialData,
  initialCursor,
  jerarquias,
  basePath,
}: {
  initialData: LicitacionSeleccion[];
  initialCursor: string | null;
  jerarquias: string[];
  basePath: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState<LicitacionSeleccion[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filtros, setFiltros] = useState<FiltrosSeleccion>(FILTROS_SELECCION_DEFAULT);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setFiltro<K extends keyof FiltrosSeleccion>(
    key: K,
    value: FiltrosSeleccion[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function fetchData(f: FiltrosSeleccion, c: string | null, append: boolean) {
    startTransition(async () => {
      const result = await buscarSeleccionAction(f, c);
      if (append) {
        setFilas((prev) => [...prev, ...result.licitaciones]);
      } else {
        setFilas(result.licitaciones);
      }
      setCursor(result.nextCursor);
    });
  }

  function aplicarFiltros() {
    fetchData(filtros, null, false);
  }

  function limpiarFiltros() {
    setBusqueda("");
    setFiltros(FILTROS_SELECCION_DEFAULT);
    fetchData(FILTROS_SELECCION_DEFAULT, null, false);
  }

  async function cargarMas() {
    if (!cursor || cargandoMas || isPending) return;
    setCargandoMas(true);
    const result = await buscarSeleccionAction(filtros, cursor);
    setFilas((prev) => [...prev, ...result.licitaciones]);
    setCursor(result.nextCursor);
    setCargandoMas(false);
  }

  const filasVisibles = filas.filter((l) => {
    const q = busqueda.toLowerCase();
    return (
      !q ||
      l.numero.toLowerCase().includes(q) ||
      (l.jerarquia ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por número o criticidad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <PanelFiltros
          onLimpiar={limpiarFiltros}
          onAplicar={aplicarFiltros}
          secciones={[
            {
              tipo: "select",
              titulo: "Criticidad",
              valor: filtros.jerarquia,
              onCambio: (v) => setFiltro("jerarquia", v),
              opciones: [
                { label: "Todas", value: "" },
                ...jerarquias.map((j) => ({ label: j, value: j })),
              ],
            },
            {
              tipo: "select",
              titulo: "Fecha de cierre",
              valor: filtros.fechaCierreVentana,
              onCambio: (v) => setFiltro("fechaCierreVentana", v),
              opciones: [
                { label: "Último mes", value: "mes" },
                { label: "Última semana", value: "semana" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaCierreDesde,
              fechaHasta: filtros.fechaCierreHasta,
              onFechaDesde: (v) => setFiltro("fechaCierreDesde", v),
              onFechaHasta: (v) => setFiltro("fechaCierreHasta", v),
            },
          ]}
        />
        {isPending && <span className="text-xs text-zinc-400">Cargando…</span>}
      </div>

      {/* Table */}
      {filasVisibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          {filas.length === 0
            ? "Sin licitaciones."
            : "Sin resultados para tu búsqueda."}
        </p>
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="min-w-[130px] px-3 py-3">Número</th>
                <th className="min-w-[130px] px-3 py-3">Tipo de Compra</th>
                <th className="min-w-[120px] px-3 py-3">Fecha Licitación</th>
                <th className="min-w-[130px] px-3 py-3">Criticidad</th>
                <th className="min-w-[100px] px-3 py-3">Comprador</th>
                {/* TODO: reactivar columnas de margen e importe de venta más adelante
                <th className="min-w-[130px] px-3 py-3 text-right">
                  Importe de Venta
                </th>
                <th className="min-w-[130px] px-3 py-3 text-right">
                  Costo Licitación
                </th>
                <th className="min-w-[130px] px-3 py-3 text-right">
                  $ Margen
                </th>
                <th className="min-w-[110px] px-3 py-3 text-right">
                  % Margen Obj.
                </th>
                <th className="min-w-[110px] px-3 py-3 text-right">
                  % Margen Lic.
                </th>
                */}
                <th className="min-w-[130px] px-3 py-3 text-right">Costo Objetivo</th>
                <th className="min-w-[140px] px-3 py-3 text-right">
                  Costo Primera Ronda
                </th>
                <th className="min-w-[130px] px-3 py-3 text-right">Mejor Costo Total</th>
                <th className="min-w-[140px] px-3 py-3 text-center">
                  Adherencia de Precio
                </th>
                <th className="min-w-[140px] px-3 py-3 text-right">Ahorro</th>
                <th className="min-w-[90px] px-3 py-3">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filasVisibles.map((l) => {
                /* TODO: reactivar columnas de margen e importe de venta más adelante
                const costo = l.costoLicitacion;
                const margenDolar =
                  l.importeVenta != null ? l.importeVenta - costo : null;
                const pctMargenObj =
                  l.costoObjetivoLicitacion != null && l.importeVenta
                    ? (l.costoObjetivoLicitacion / l.importeVenta) * 100
                    : null;
                const pctMargenLic =
                  margenDolar != null && l.importeVenta
                    ? (margenDolar / l.importeVenta) * 100
                    : null;
                */
                const r = l.resumenAhorro;

                return (
                  <tr
                    key={l.id}
                    className="hover:bg-zinc-50/50 transition-colors duration-150"
                  >
                    <td className="px-3 py-3 font-medium text-zinc-800">
                      <Link
                        href={`${basePath}/comprador/seleccion-proveedores/${l.id}`}
                        className="hover:text-[var(--color-primario)] hover:underline"
                      >
                        {l.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {l.tipoLicitacion ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {formatFecha(l.fechaEjecucion)}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {l.jerarquia ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">Comprador 1</td>

                    {/* TODO: reactivar columnas de margen e importe de venta más adelante
                    <td className="px-3 py-3 text-right text-zinc-600">
                      {formatPeso(l.importeVenta)}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-600">
                      {costo > 0 ? formatPeso(costo) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {margenDolar != null ? (
                        <span
                          className={
                            margenDolar >= 0
                              ? "font-medium text-emerald-700"
                              : "font-medium text-red-600"
                          }
                        >
                          {formatPeso(margenDolar)}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-500">
                      {formatPct(pctMargenObj)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {pctMargenLic != null ? (
                        <span
                          className={
                            pctMargenLic >= 0
                              ? "font-medium text-emerald-700"
                              : "font-medium text-red-600"
                          }
                        >
                          {formatPct(pctMargenLic)}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    */}

                    {/* Costo Objetivo — siempre disponible desde la creación */}
                    <td className="px-3 py-3 text-right text-zinc-600">
                      {formatMoneda(r.presupuestoObjetivoTotal, l.monedaPredominante)}
                    </td>

                    {!r.hayOfertas ? (
                      <td colSpan={4} className="px-3 py-3">
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <IconClock className="h-4 w-4 shrink-0" />
                          <span className="text-xs font-medium">
                            En espera de datos
                          </span>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-right text-zinc-600">
                          {formatMoneda(r.primeraRondaTotal, l.monedaPredominante)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-zinc-800">
                          {formatMoneda(r.mejorPrecioActualTotal, l.monedaPredominante)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${adherenciaBadgeClass(r.adherenciaPct)}`}
                          >
                            {r.adherenciaPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-right font-medium ${ahorroColorClass(r.ahorroTotal)}`}>
                          {formatMoneda(r.ahorroTotal, l.monedaPredominante)}
                          <span className="ml-1 text-xs font-normal">
                            ({formatPct(r.ahorroPct)})
                          </span>
                        </td>
                      </>
                    )}

                    <td className="px-3 py-3">
                      <Badge variant={ESTADO_VARIANT[l.estado] ?? "neutral"}>{l.estado}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`${basePath}/comprador/seleccion-proveedores/${l.id}`}
                          title="Ver resultados"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <IconEye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled
                          title="Próximamente"
                          className="rounded-md p-1.5 text-zinc-300 cursor-not-allowed"
                        >
                          <IconChartBar className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Load more — mantiene el cálculo de ahorro acotado a lo visible */}
      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={cargarMas}
            disabled={cargandoMas || isPending}
            className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargandoMas ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
