"use client";

import { IconPencil } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import type { LicitacionRow } from "@/src/lib/licitaciones";
import PanelFiltros from "@/app/_components/PanelFiltros";

// ── Types ─────────────────────────────────────────────────────────────────────

type FiltrosManual = {
  fechaInicio: string;
  fechaDesde: string;
  fechaHasta: string;
};

const FILTROS_DEFAULT: FiltrosManual = {
  fechaInicio: "",
  fechaDesde: "",
  fechaHasta: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFechaHora(fechaISO: string): string {
  return new Date(fechaISO).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPeso(valor: number | null): string {
  if (valor === null) return "—";
  return `$${valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManualTabla({
  licitaciones,
  basePath,
}: {
  licitaciones: LicitacionRow[];
  basePath: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosManual>(FILTROS_DEFAULT);

  function setFiltroField<K extends keyof FiltrosManual>(
    key: K,
    value: FiltrosManual[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  const filtradas = licitaciones.filter((l) => {
    // ── Búsqueda ──
    const q = busqueda.toLowerCase();
    if (
      q &&
      !l.numero.toLowerCase().includes(q) &&
      !(l.jerarquia ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }

    // ── Fecha de inicio de cotización ──
    if (filtros.fechaInicio && filtros.fechaInicio !== "") {
      const inicioMs = l.fechaInicioLicitacion
        ? new Date(l.fechaInicioLicitacion).getTime()
        : null;
      if (inicioMs !== null) {
        const now = Date.now();
        if (filtros.fechaInicio === "hoy") {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (inicioMs < startOfDay.getTime()) return false;
        } else if (filtros.fechaInicio === "semana") {
          if (inicioMs < now - 7 * 24 * 60 * 60 * 1000) return false;
        } else if (filtros.fechaInicio === "personalizado") {
          if (filtros.fechaDesde) {
            if (inicioMs < new Date(filtros.fechaDesde).getTime()) return false;
          }
          if (filtros.fechaHasta) {
            const end = new Date(filtros.fechaHasta);
            end.setHours(23, 59, 59, 999);
            if (inicioMs > end.getTime()) return false;
          }
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
          placeholder="Buscar por número o criticidad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <PanelFiltros
          onLimpiar={() => setFiltros(FILTROS_DEFAULT)}
          secciones={[
            {
              tipo: "select",
              titulo: "Fecha de inicio de cotización",
              valor: filtros.fechaInicio,
              onCambio: (v) => setFiltroField("fechaInicio", v),
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Hoy", value: "hoy" },
                { label: "Última semana", value: "semana" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaDesde,
              fechaHasta: filtros.fechaHasta,
              onFechaDesde: (v) => setFiltroField("fechaDesde", v),
              onFechaHasta: (v) => setFiltroField("fechaHasta", v),
            },
          ]}
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          Sin cotizaciones manuales en proceso.
        </p>
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="min-w-[130px] px-3 py-3">Número</th>
                  <th className="min-w-[120px] px-3 py-3">Criticidad</th>
                  <th className="min-w-[110px] px-3 py-3">Comprador</th>
                  <th className="min-w-[140px] px-3 py-3">Costo Objetivo</th>
                  <th className="min-w-[170px] px-3 py-3">Fecha de creación</th>
                  <th className="min-w-[80px] px-3 py-3 text-center">Proveedores</th>
                  <th className="min-w-[160px] px-3 py-3">Estatus</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtradas.map((l: any) => (
                  <tr key={l.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="px-3 py-3 font-medium text-zinc-800">{l.numero}</td>
                    <td className="px-3 py-3 text-zinc-600">{l.jerarquia ?? "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">Comprador 1</td>
                    <td className="px-3 py-3 text-zinc-600">{formatPeso(l.costoObjetivo)}</td>
                    <td className="px-3 py-3 text-zinc-600">{formatFechaHora(l.fechaCreacion)}</td>
                    <td className="px-3 py-3 text-center text-zinc-600">{l.numProveedores}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        Capturando cotizaciones
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`${basePath}/comprador/licitaciones-proceso/${l.id}/captura-manual`}
                          className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                          title="Capturar cotizaciones"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                          Capturar
                        </Link>
                        <Link
                          href={`${basePath}/comprador/licitaciones/${l.id}/editar`}
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
                          title="Editar"
                        >
                          <IconPencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
