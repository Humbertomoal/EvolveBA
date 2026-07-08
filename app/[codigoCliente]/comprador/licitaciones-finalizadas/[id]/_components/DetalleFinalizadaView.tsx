"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import Badge from "@/src/components/Badge";
import { formatImporte } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AsignacionDetalle = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  cantidadAsignada: number;
  precioUnitario: number;
  moneda: string;
  estatusProveedor: string;
  ordenNumero: string | null;
};

export type ItemAsignado = {
  id: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  asignaciones: AsignacionDetalle[];
};

export type HistorialPujas = {
  proveedores: Array<{ id: string; nombre: string }>;
  items: Array<{
    id: string;
    productoNombre: string;
    unidadMedida: string;
    cantidadSolicitada: number;
    moneda: string;
    filas: Array<{
      ronda: number;
      ofertas: Record<string, number | null>;
    }>;
    ganadorIds: string[];
  }>;
};

export type DetalleFinalizadaProps = {
  licitacion: {
    id: string;
    numero: string;
    jerarquia: string | null;
    tipoLicitacion: string | null;
    estado: string;
    modoLicitacion: string;
    fechaCreacion: string;
    fechaFinalizacion: string;
  };
  items: ItemAsignado[];
  historial: HistorialPujas | null;
  basePath: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function estatusProveedorVariant(estatus: string): "pendiente" | "success" | "danger" | "neutral" {
  if (estatus === "Pendiente") return "pendiente";
  if (estatus === "Aprobado") return "success";
  if (estatus === "Rechazado") return "danger";
  return "neutral";
}

function estadoLicitacionVariant(estado: string): "finalizada" | "cancelada" | "neutral" {
  if (estado === "Finalizada") return "finalizada";
  if (estado === "Cancelada") return "cancelada";
  return "neutral";
}

// ── Tab 1: Ganadores ──────────────────────────────────────────────────────────

function GanadoresTab({ items }: { items: ItemAsignado[] }) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        No hay asignaciones registradas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item: any) => {
        const totalAsignado = item.asignaciones.reduce(
          (s: any, a: any) => s + a.cantidadAsignada,
          0
        );
        const totalesPorMoneda = item.asignaciones.reduce((acc: any, a: any) => {
          acc[a.moneda] = (acc[a.moneda] ?? 0) + a.cantidadAsignada * a.precioUnitario;
          return acc;
        }, {} as Record<string, number>);

        return (
          <div
            key={item.id}
            className="rounded-card border border-border bg-white shadow-card overflow-hidden"
          >
            {/* Item header */}
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="font-medium text-zinc-900">{item.productoNombre}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Solicitado: {item.cantidadSolicitada} {item.unidadMedida}
              </p>
            </div>

            {item.asignaciones.length === 0 ? (
              <p className="px-4 py-4 text-sm text-zinc-400">
                Sin asignación.
              </p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2">Proveedor</th>
                    <th className="px-4 py-2 text-right">Cantidad</th>
                    <th className="px-4 py-2 text-right">Precio Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                    <th className="px-4 py-2">Estatus</th>
                    <th className="px-4 py-2">OC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {item.asignaciones.map((a: any) => (
                    <tr key={a.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="px-4 py-2.5 text-zinc-700">
                        {a.proveedorNombre}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">
                        {a.cantidadAsignada} {item.unidadMedida}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">
                        {formatImporte(a.precioUnitario, a.moneda)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-zinc-800">
                        {formatImporte(a.cantidadAsignada * a.precioUnitario, a.moneda)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={estatusProveedorVariant(a.estatusProveedor)}>
                          {a.estatusProveedor}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">
                        {a.ordenNumero ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {Object.entries(totalesPorMoneda).map(([moneda, total], i) => (
                    <tr key={moneda} className={`${i === 0 ? "border-t border-zinc-200" : "border-t border-zinc-100"} bg-zinc-50 text-xs font-semibold text-zinc-700 hover:bg-zinc-50/50 transition-colors duration-150`}>
                      <td className="px-4 py-2">{i === 0 ? "Total" : ""}</td>
                      <td className="px-4 py-2 text-right">
                        {i === 0 ? `${totalAsignado} ${item.unidadMedida}` : ""}
                      </td>
                      <td />
                      <td className="px-4 py-2 text-right">{formatImporte(total as number, moneda)}</td>
                      <td />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 2: Historial de Pujas ──────────────────────────────────────────────────

function HistorialPujasTab({
  historial,
  modoLicitacion,
}: {
  historial: HistorialPujas | null;
  modoLicitacion: string;
}) {
  if (modoLicitacion === "Manual") {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Esta licitación fue cotizada de forma manual. El historial de pujas no
        está disponible.
      </p>
    );
  }

  if (!historial || historial.items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Sin ofertas registradas.
      </p>
    );
  }

  const { proveedores, items } = historial;

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
          Precio más bajo en la ronda
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-100 ring-1 ring-blue-300" />
          Proveedor ganador
        </span>
      </div>

      {items.map((item: any) => {
        // Compute minimum price per ronda
        const minPorRonda: Record<number, number> = {};
        for (const fila of item.filas) {
          const precios = Object.values(fila.ofertas).filter(
            (p): p is number => p !== null
          );
          if (precios.length > 0) {
            minPorRonda[fila.ronda] = Math.min(...precios);
          }
        }

        return (
          <div
            key={item.id}
            className="rounded-card border border-border bg-white shadow-card overflow-hidden"
          >
            {/* Item header */}
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="font-medium text-zinc-900">{item.productoNombre}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Solicitado: {item.cantidadSolicitada} {item.unidadMedida}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="min-w-[80px] px-4 py-2">Ronda</th>
                    {proveedores.map((p: any)=> (
                      <th
                        key={p.id}
                        className="min-w-[150px] px-4 py-2 text-right"
                      >
                        {p.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {item.filas.map((fila: any) => (
                    <tr key={fila.ronda} className="hover:bg-zinc-50/50 transition-colors duration-150">
                      <td className="px-4 py-2.5 font-medium text-zinc-600">
                        Ronda {fila.ronda}
                      </td>
                      {proveedores.map((p: any)=> {
                        const precio = fila.ofertas[p.id];
                        const esGanador = item.ganadorIds.includes(p.id);
                        const esMinimo =
                          precio !== null &&
                          minPorRonda[fila.ronda] === precio;

                        const cellClass = esGanador
                          ? "bg-blue-50 text-blue-800 font-semibold"
                          : esMinimo
                            ? "bg-emerald-50 text-emerald-800 font-medium"
                            : "text-zinc-600";

                        return (
                          <td
                            key={p.id}
                            className={`px-4 py-2.5 text-right ${cellClass}`}
                          >
                            {precio !== null ? formatImporte(precio, item.moneda) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = "ganadores" | "historial";

export default function DetalleFinalizadaView({
  licitacion,
  items,
  historial,
  basePath,
}: DetalleFinalizadaProps) {
  const [tab, setTab] = useState<Tab>("ganadores");
  usePageTitle(licitacion.numero);

  const totalesPorMoneda = items.reduce((acc: any, item: any) => {
    for (const a of item.asignaciones) {
      acc[a.moneda] = (acc[a.moneda] ?? 0) + a.cantidadAsignada * a.precioUnitario;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Back link */}
      <Link
        href={`${basePath}/comprador/licitaciones-finalizadas`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800"
      >
        <IconArrowLeft className="h-4 w-4" />
        Licitaciones Finalizadas
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Badge variant={estadoLicitacionVariant(licitacion.estado)}>
              {licitacion.estado}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            {licitacion.jerarquia && <span>{licitacion.jerarquia}</span>}
            {licitacion.tipoLicitacion && (
              <span>{licitacion.tipoLicitacion}</span>
            )}
            <span>Modo: {licitacion.modoLicitacion}</span>
            <span>Creada: {formatFecha(licitacion.fechaCreacion)}</span>
            <span>Finalizada: {formatFecha(licitacion.fechaFinalizacion)}</span>
          </div>
        </div>
        {Object.keys(totalesPorMoneda).length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-3 text-right">
            <p className="text-xs text-zinc-400">Costo total asignado</p>
            {Object.entries(totalesPorMoneda).map(([moneda, total]) => (
              <p key={moneda} className="mt-0.5 text-xl font-semibold text-zinc-900">
                {formatImporte(total as number, moneda)}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-0">
          {(
            [
              { key: "ganadores", label: "Ganadores y Asignación" },
              { key: "historial", label: "Historial de Pujas" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-[var(--color-primario)] text-[var(--color-primario)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "ganadores" ? (
          <GanadoresTab items={items} />
        ) : (
          <HistorialPujasTab
            historial={historial}
            modoLicitacion={licitacion.modoLicitacion}
          />
        )}
      </div>
    </div>
  );
}
