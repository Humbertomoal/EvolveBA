"use client";

import { IconChartBar, IconEye } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import PanelFiltros from "@/app/_components/PanelFiltros";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import type { LicitacionCerrada } from "../page";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeso(n: number | null): string {
  if (n === null || n === 0) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

const ESTADO_VARIANT: Record<string, BadgeVariant> = {
  Cerrada: "neutral",
  Finalizada: "finalizada",
  Cancelada: "cancelada",
};

// ── Filter state ───────────────────────────────────────────────────────────────

type FiltrosSeleccion = {
  jerarquia: string;
  fechaCierreVentana: string;
  fechaCierreDesde: string;
  fechaCierreHasta: string;
};

const FILTROS_DEFAULT: FiltrosSeleccion = {
  jerarquia: "",
  fechaCierreVentana: "mes",
  fechaCierreDesde: "",
  fechaCierreHasta: "",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeleccionTabla({
  licitaciones,
  basePath,
}: {
  licitaciones: LicitacionCerrada[];
  basePath: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosSeleccion>(FILTROS_DEFAULT);

  function setFiltro<K extends keyof FiltrosSeleccion>(
    key: K,
    value: FiltrosSeleccion[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  const jerarquiasUnicas = [
    ...new Set(licitaciones.map((l: any) => l.jerarquia).filter(Boolean)),
  ] as string[];

  const filtradas = licitaciones.filter((l) => {
    // Búsqueda
    const q = busqueda.toLowerCase();
    if (
      q &&
      !l.numero.toLowerCase().includes(q) &&
      !(l.jerarquia ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }

    // Jerarquía
    if (filtros.jerarquia && l.jerarquia !== filtros.jerarquia) {
      return false;
    }

    // Fecha de cierre
    if (filtros.fechaCierreVentana) {
      const cierreMs = l.fechaCerrada
        ? new Date(l.fechaCerrada).getTime()
        : null;
      if (cierreMs === null) return false;
      const now = Date.now();
      if (filtros.fechaCierreVentana === "semana") {
        if (cierreMs < now - 7 * 24 * 60 * 60 * 1000) return false;
      } else if (filtros.fechaCierreVentana === "mes") {
        if (cierreMs < now - 30 * 24 * 60 * 60 * 1000) return false;
      } else if (filtros.fechaCierreVentana === "personalizado") {
        if (
          filtros.fechaCierreDesde &&
          cierreMs < new Date(filtros.fechaCierreDesde).getTime()
        ) {
          return false;
        }
        if (filtros.fechaCierreHasta) {
          const end = new Date(filtros.fechaCierreHasta);
          end.setHours(23, 59, 59, 999);
          if (cierreMs > end.getTime()) return false;
        }
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por número o jerarquía..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <PanelFiltros
          secciones={[
            {
              tipo: "select",
              titulo: "Jerarquía",
              valor: filtros.jerarquia,
              onCambio: (v) => setFiltro("jerarquia", v),
              opciones: [
                { label: "Todas", value: "" },
                ...jerarquiasUnicas.map((j) => ({ label: j, value: j })),
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
          onLimpiar={() => {
            setBusqueda("");
            setFiltros(FILTROS_DEFAULT);
          }}
        />
      </div>

      {/* Table */}
      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          Sin licitaciones.
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
                <th className="min-w-[130px] px-3 py-3">Jerarquía</th>
                <th className="min-w-[100px] px-3 py-3">Comprador</th>
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
                <th className="min-w-[90px] px-3 py-3">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtradas.map((l: any) => {
                const costo = l.costoLicitacion;
                const margenDolar =
                  l.importeVenta != null ? l.importeVenta - costo : null;
                const pctMargenObj =
                  l.costoObjetivo != null && l.importeVenta
                    ? (l.costoObjetivo / l.importeVenta) * 100
                    : null;
                const pctMargenLic =
                  margenDolar != null && l.importeVenta
                    ? (margenDolar / l.importeVenta) * 100
                    : null;

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
    </div>
  );
}
