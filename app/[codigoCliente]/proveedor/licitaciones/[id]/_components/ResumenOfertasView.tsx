"use client";

import {
  IconArrowLeft,
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MejorOfertaItem = {
  licitacionItemId: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  mejorPrecio: number | null;
  cantidadOfertada: number | null;
  rondaCotizado: number | null;
  puedeCumplirFecha: boolean | null;
  fechaEstimadaEntrega: string | null;
  historial: Array<{
    ronda: number;
    precioUnitario: number;
    cantidadDisponible: number;
  }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeso(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResumenOfertasView({
  licitacion,
  subEstado,
  resumen,
  basePath,
}: {
  licitacion: { numero: string; jerarquia: string | null };
  subEstado: "en_espera" | "no_seleccionado";
  resumen: MejorOfertaItem[];
  basePath: string;
}) {
  const [historialVisible, setHistorialVisible] = useState(false);
  usePageTitle(licitacion.numero);

  const hayOfertas = resumen.some((r) => r.mejorPrecio !== null);

  // Build flat historial rows: one entry per (item, ronda)
  const historialFlat: Array<{
    licitacionItemId: string;
    productoNombre: string;
    esFirstRow: boolean;
    ronda: number;
    precioUnitario: number;
    cantidadDisponible: number;
    diffPct: number | null; // null = no anterior para este item
  }> = [];

  for (const item of resumen) {
    if (item.historial.length === 0) continue;
    const sorted = [...item.historial].sort((a: any, b: any) => a.ronda - b.ronda);
    sorted.forEach((oferta, idx) => {
      const prev = idx > 0 ? sorted[idx - 1] : null;
      const diffPct = prev
        ? ((oferta.precioUnitario - prev.precioUnitario) / prev.precioUnitario) * 100
        : null;
      historialFlat.push({
        licitacionItemId: item.licitacionItemId,
        productoNombre: item.productoNombre,
        esFirstRow: idx === 0,
        ronda: oferta.ronda,
        precioUnitario: oferta.precioUnitario,
        cantidadDisponible: oferta.cantidadDisponible,
        diffPct,
      });
    });
  }

  const CELL = "px-4 py-3 text-sm";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href={`${basePath}/proveedor/licitaciones`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Mis Licitaciones
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {subEstado === "en_espera" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-500">
              <IconClock className="h-4 w-4" />
              En espera de resultado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-500">
              <IconX className="h-4 w-4" />
              No seleccionado
            </span>
          )}
        </div>
        {licitacion.jerarquia && (
          <p className="text-sm text-zinc-500">{licitacion.jerarquia}</p>
        )}
      </div>

      {/* Mensaje informativo */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          subEstado === "en_espera"
            ? "border-zinc-200 bg-zinc-50 text-zinc-600"
            : "border-zinc-200 bg-zinc-50 text-zinc-600"
        }`}
      >
        {subEstado === "en_espera"
          ? "El comprador está revisando los resultados de la licitación. Recibirás una notificación cuando se publiquen las asignaciones."
          : "No fuiste seleccionado en esta licitación. El comprador asignó los materiales a otros proveedores."}
      </div>

      {/* Sección 1: Mejor oferta por material */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-800">
          Resumen de mi mejor oferta por material
        </h2>

        {!hayOfertas ? (
          <p className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] py-8 text-center text-sm text-zinc-400">
            No enviaste ofertas en esta licitación.
          </p>
        ) : (
          <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="min-w-[180px] px-4 py-3">Material</th>
                  <th className="min-w-[80px] px-4 py-3">U.M.</th>
                  <th className="min-w-[100px] px-4 py-3 text-right">Cant. solicitada</th>
                  <th className="min-w-[100px] px-4 py-3 text-right">Cant. ofertada</th>
                  <th className="min-w-[120px] px-4 py-3 text-right">Mejor precio</th>
                  <th className="min-w-[80px] px-4 py-3 text-center">Ronda</th>
                  <th className="min-w-[110px] px-4 py-3 text-center">Cumple fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {resumen.map((item: any) =>
                  item.mejorPrecio === null ? (
                    <tr key={item.licitacionItemId} className="bg-zinc-50/40 hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className={`${CELL} font-medium text-zinc-500`}>
                        {item.productoNombre}
                      </td>
                      <td className={`${CELL} text-zinc-400`}>{item.unidadMedida}</td>
                      <td className={`${CELL} text-right text-zinc-400`}>
                        {item.cantidadSolicitada}
                      </td>
                      <td
                        colSpan={4}
                        className={`${CELL} text-zinc-400 text-xs italic`}
                      >
                        No cotizó este material
                      </td>
                    </tr>
                  ) : (
                    <Fragment key={item.licitacionItemId}>
                      <tr className="hover:bg-zinc-50/50 transition-colors duration-150">
                        <td className={`${CELL} font-medium text-zinc-800`}>
                          {item.productoNombre}
                        </td>
                        <td className={`${CELL} text-zinc-500`}>{item.unidadMedida}</td>
                        <td className={`${CELL} text-right text-zinc-600`}>
                          {item.cantidadSolicitada}
                        </td>
                        <td className={`${CELL} text-right text-zinc-700`}>
                          {item.cantidadOfertada}
                        </td>
                        <td className={`${CELL} text-right font-semibold text-zinc-900`}>
                          {formatPeso(item.mejorPrecio)}
                        </td>
                        <td className={`${CELL} text-center`}>
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                            {item.rondaCotizado}
                          </span>
                        </td>
                        <td className={`${CELL} text-center`}>
                          {item.puedeCumplirFecha ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <IconCircleCheck className="h-3.5 w-3.5" />
                              Sí
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                <IconClock className="h-3.5 w-3.5" />
                                No
                              </span>
                              {item.fechaEstimadaEntrega && (
                                <p className="mt-0.5 text-xs text-zinc-400">
                                  {formatFecha(item.fechaEstimadaEntrega)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Sección 2: Historial de ofertas */}
      {historialFlat.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setHistorialVisible((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            {historialVisible ? (
              <IconChevronUp className="h-4 w-4" />
            ) : (
              <IconChevronDown className="h-4 w-4" />
            )}
            {historialVisible ? "Ocultar historial" : "Ver historial completo de ofertas"}
          </button>

          {historialVisible && (
            <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="min-w-[180px] px-4 py-3">Material</th>
                    <th className="min-w-[80px] px-4 py-3 text-center">Ronda</th>
                    <th className="min-w-[120px] px-4 py-3 text-right">Precio unit.</th>
                    <th className="min-w-[100px] px-4 py-3 text-right">Cant. disp.</th>
                    <th className="min-w-[120px] px-4 py-3 text-center">Δ vs anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {historialFlat.map((row, idx) => (
                    <tr
                      key={`${row.licitacionItemId}-${row.ronda}`}
                      className={`hover:bg-zinc-50/50 transition-colors duration-150 ${row.esFirstRow && idx > 0 ? "border-t-2 border-zinc-200" : ""}`}
                    >
                      <td className={`${CELL} ${row.esFirstRow ? "font-medium text-zinc-800" : "text-zinc-400"}`}>
                        {row.esFirstRow ? row.productoNombre : ""}
                      </td>
                      <td className={`${CELL} text-center`}>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                          {row.ronda}
                        </span>
                      </td>
                      <td className={`${CELL} text-right font-medium text-zinc-800`}>
                        {formatPeso(row.precioUnitario)}
                      </td>
                      <td className={`${CELL} text-right text-zinc-600`}>
                        {row.cantidadDisponible}
                      </td>
                      <td className={`${CELL} text-center`}>
                        {row.diffPct === null ? (
                          <span className="text-xs text-zinc-300">—</span>
                        ) : row.diffPct < 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <IconArrowDown className="h-3.5 w-3.5" />
                            {Math.abs(row.diffPct).toFixed(1)}%
                          </span>
                        ) : row.diffPct > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                            <IconArrowUp className="h-3.5 w-3.5" />
                            {row.diffPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">Sin cambio</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
