"use client";

import {
  IconCheck,
  IconClock,
  IconDownload,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  forzarCierreSeleccionAction,
  reasignarProveedorAction,
} from "@/src/lib/asignacionActions";
import { formatImporte } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import type {
  AsignacionDetalle,
  LicitacionInfo,
} from "./types";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Mapeo de estatus de proveedor -> variante de Badge más cercana.
// No existe una variante de negocio específica para "Aprobado"/"Confirmado",
// así que se usa la genérica "success" (mismo verde que tenían ambos antes).
const ESTATUS_VARIANT: Record<string, BadgeVariant> = {
  Pendiente: "pendiente",
  Aprobado: "success",
  Rechazado: "danger",
  Confirmado: "success",
};

// ── Countdown ─────────────────────────────────────────────────────────────────

function CountdownCell({ endMs }: { endMs: number | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endMs) return;
    const tick = () => setRemaining(endMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  if (!endMs || remaining === null) return <span className="text-zinc-300">—</span>;
  if (remaining <= 0)
    return <span className="text-xs font-medium text-red-600">Tiempo agotado</span>;

  const totalSecs = Math.floor(remaining / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const display =
    hrs > 0
      ? `${hrs}h ${pad(mins)}m`
      : `${pad(mins)}m ${pad(secs)}s`;

  const colorCls =
    totalSecs < 3600
      ? "text-red-600"
      : totalSecs < 7200
        ? "text-amber-600"
        : "text-zinc-600";

  return <span className={`text-xs font-mono font-medium ${colorCls}`}>{display}</span>;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function generarPDF(licitacion: LicitacionInfo, asignaciones: AsignacionDetalle[]) {
  const grupos = new Map<
    string,
    { nombre: string; filas: AsignacionDetalle[] }
  >();
  for (const a of asignaciones) {
    if (!grupos.has(a.proveedorId)) {
      grupos.set(a.proveedorId, { nombre: a.proveedorNombre, filas: [] });
    }
    grupos.get(a.proveedorId)!.filas.push(a);
  }

  const totalesPDF: Record<string, number> = {};
  for (const a of asignaciones) {
    const m = a.moneda ?? "MXN";
    totalesPDF[m] = (totalesPDF[m] ?? 0) + a.cantidadAsignada * a.precioUnitario;
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Licitación ${licitacion.numero}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 30px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; margin-bottom: 20px; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .total { font-weight: bold; font-size: 13px; text-align: right; margin-top: 16px; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 12px; font-size: 10px; }
  .verde { background: #dcfce7; color: #15803d; }
  .gris { background: #f4f4f5; color: #52525b; }
  .rojo { background: #fee2e2; color: #dc2626; }
</style></head><body>
<h1>Licitación ${licitacion.numero}</h1>
<div class="meta">
  ${licitacion.jerarquia ? `Criticidad: ${licitacion.jerarquia} &nbsp;|&nbsp;` : ""}
  ${licitacion.tipoLicitacion ? `Tipo: ${licitacion.tipoLicitacion} &nbsp;|&nbsp;` : ""}
  Comprador: Comprador 1
</div>
${[...grupos.entries()]
  .map(
    ([, g]) => `
  <h2>Proveedor: ${g.nombre}</h2>
  <table>
    <thead><tr>
      <th>Material</th><th class="right">Cantidad</th><th>Unidad</th><th>Moneda</th>
      <th class="right">Precio Unit.</th><th>Fecha Objetivo</th>
      <th>Fecha Est. Prov.</th><th class="right">Subtotal</th><th>Estatus</th>
    </tr></thead>
    <tbody>
      ${g.filas
        .map((a: any)=> {
          const badgeCls =
            a.estatusProveedor === "Aprobado" || a.estatusProveedor === "Confirmado"
              ? "verde"
              : a.estatusProveedor === "Rechazado"
                ? "rojo"
                : "gris";
          const mon = a.moneda ?? "MXN";
          return `<tr>
          <td>${a.productoNombre}</td>
          <td class="right">${a.cantidadAsignada}</td>
          <td>${a.unidadMedida}</td>
          <td>${mon}</td>
          <td class="right">${formatImporte(a.precioUnitario, mon)}</td>
          <td>${formatFecha(a.fechaObjetivo)}</td>
          <td>${formatFecha(a.fechaEstimadaProveedor)}</td>
          <td class="right">${formatImporte(a.cantidadAsignada * a.precioUnitario, mon)}</td>
          <td><span class="badge ${badgeCls}">${a.estatusProveedor}</span></td>
        </tr>`;
        })
        .join("")}
    </tbody>
  </table>`
  )
  .join("")}
<div class="total">${Object.entries(totalesPDF).map(([m, v]) => `Total ${m}: ${formatImporte(v, m)}`).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</div>
<script>window.print();</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeguimientoView({
  licitacion,
  asignaciones,
  basePath,
}: {
  licitacion: LicitacionInfo;
  asignaciones: AsignacionDetalle[];
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle(`Licitación ${licitacion.numero} — Seguimiento`);
  const [modalReasignar, setModalReasignar] = useState<AsignacionDetalle | null>(null);
  const [nuevoProveedorId, setNuevoProveedorId] = useState<string>("");
  const [ejecutando, setEjecutando] = useState(false);

  const todosConfirmados = asignaciones.every(
    (a) => a.estatusProveedor === "Confirmado" || a.estatusProveedor === "Aprobado"
  );

  const totalesPorMoneda = asignaciones.reduce((acc: any, a: any) => {
    const moneda = a.moneda ?? "MXN";
    acc[moneda] = (acc[moneda] ?? 0) + a.cantidadAsignada * a.precioUnitario;
    return acc;
  }, {} as Record<string, number>);
  const costoTotal = Object.values(totalesPorMoneda).reduce((s: any, v: any) => s + v, 0)as number;
  const margen =
    licitacion.importeVenta != null
      ? licitacion.importeVenta - costoTotal
      : null;
  const pctMargen =
    margen != null && licitacion.importeVenta
      ? (margen / licitacion.importeVenta) * 100
      : null;

  async function handleForzarCierre() {
    if (
      !window.confirm(
        "¿Forzar el cierre? Todas las confirmaciones pendientes quedarán como Aprobadas."
      )
    )
      return;
    setEjecutando(true);
    await forzarCierreSeleccionAction(licitacion.id, basePath);
    router.refresh();
    setEjecutando(false);
  }

  async function handleReasignar() {
    if (!modalReasignar || !nuevoProveedorId) return;
    const oferta = modalReasignar.ofertasAlternativas.find(
      (o: any) => o.proveedorId === nuevoProveedorId
    );
    if (!oferta) return;
    setEjecutando(true);
    await reasignarProveedorAction(
      modalReasignar.id,
      nuevoProveedorId,
      oferta.precioUnitario,
      oferta.ronda,
      oferta.puedeCumplirFecha ? null : oferta.fechaEstimadaEntrega,
      licitacion.tiempoConfirmacionHoras,
      licitacion.id,
      basePath
    );
    setModalReasignar(null);
    router.refresh();
    setEjecutando(false);
  }

  function openReasignar(a: AsignacionDetalle) {
    setNuevoProveedorId(a.ofertasAlternativas[0]?.proveedorId ?? "");
    setModalReasignar(a);
  }

  const CELL = "px-3 py-3 text-sm";

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`${basePath}/comprador/seleccion-proveedores`}
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            ← Selección de Proveedores
          </Link>
          <p className="text-sm text-zinc-500">
            {[licitacion.jerarquia, licitacion.tipoLicitacion, "Comprador 1"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {todosConfirmados && (
            <Link
              href={`${basePath}/comprador/seleccion-proveedores`}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <IconCheck className="mr-1.5 inline h-4 w-4" />
              Finalizar licitación
            </Link>
          )}
          <button
            type="button"
            onClick={handleForzarCierre}
            disabled={ejecutando}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            Forzar cierre
          </button>
          <button
            type="button"
            onClick={() => generarPDF(licitacion, asignaciones)}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <IconDownload className="h-4 w-4" />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Tabla de seguimiento */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="min-w-[150px] px-3 py-3">Material</th>
              <th className="min-w-[160px] px-3 py-3">Proveedor</th>
              <th className="min-w-[80px] px-3 py-3 text-right">Cantidad</th>
              <th className="min-w-[110px] px-3 py-3 text-right">Precio unit.</th>
              <th className="min-w-[110px] px-3 py-3">Fecha objetivo</th>
              <th className="min-w-[140px] px-3 py-3">Fecha est. prov.</th>
              <th className="min-w-[110px] px-3 py-3">Estatus</th>
              <th className="min-w-[120px] px-3 py-3">Tiempo restante</th>
              <th className="min-w-[100px] px-3 py-3">OC</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {asignaciones.map((a: any) => (
              <tr
                key={a.id}
                className={`transition-colors duration-150 hover:bg-zinc-50/50 ${
                  a.orden > 1 ? "bg-amber-50/30" : ""
                }`}
              >
                <td className={`${CELL} font-medium text-zinc-800`}>
                  {a.orden > 1 ? (
                    <span className="text-zinc-500">
                      <span className="mr-1 text-zinc-300">↳</span>
                      {a.productoNombre}
                    </span>
                  ) : (
                    a.productoNombre
                  )}
                  <span className="ml-1 text-xs text-zinc-400">
                    {a.unidadMedida}
                  </span>
                </td>
                <td className={`${CELL} text-zinc-700`}>{a.proveedorNombre}</td>
                <td className={`${CELL} text-right text-zinc-600`}>
                  {a.cantidadAsignada}
                </td>
                <td className={`${CELL} text-right font-medium text-zinc-800`}>
                  {formatImporte(a.precioUnitario, a.moneda ?? "MXN")}
                </td>
                <td className={`${CELL} text-zinc-500`}>
                  {formatFecha(a.fechaObjetivo)}
                </td>
                <td className={CELL}>
                  {a.fechaEstimadaProveedor ? (
                    <span className="text-xs text-amber-600">
                      {formatFecha(a.fechaEstimadaProveedor)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Cumple fecha
                    </span>
                  )}
                </td>
                <td className={CELL}>
                  <Badge variant={ESTATUS_VARIANT[a.estatusProveedor] ?? "neutral"}>
                    {a.estatusProveedor}
                  </Badge>
                  {a.motivoRechazo && (
                    <p className="mt-0.5 text-xs text-red-500">{a.motivoRechazo}</p>
                  )}
                </td>
                <td className={CELL}>
                  {a.estatusProveedor === "Pendiente" ? (
                    <div className="flex items-center gap-1 text-zinc-500">
                      <IconClock className="h-3.5 w-3.5 shrink-0" />
                      <CountdownCell
                        endMs={
                          a.fechaLimiteConfirmacion
                            ? new Date(a.fechaLimiteConfirmacion).getTime()
                            : null
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className={CELL}>
                  {a.ordenNumero ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {a.ordenNumero}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className={CELL}>
                  {a.estatusProveedor === "Rechazado" && (
                    <button
                      type="button"
                      onClick={() => openReasignar(a)}
                      className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <IconRefresh className="h-3.5 w-3.5" />
                      Reasignar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totales */}
          <tfoot>
            {Object.entries(totalesPorMoneda).map(([moneda, total], i) => (
              <tr key={moneda} className={`${i === 0 ? "border-t-2 border-zinc-200" : "border-t border-zinc-100"} bg-zinc-50`}>
                <td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold text-zinc-700">
                  {i === 0 ? "Costo total" : ""}
                  {Object.keys(totalesPorMoneda).length > 1 && (
                    <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{moneda}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-sm font-bold text-zinc-900">
                  {formatImporte(total as number, moneda)}
                </td>
                <td colSpan={6} />
              </tr>
            ))}
            {Object.keys(totalesPorMoneda).length === 0 && (
              <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                <td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold text-zinc-700">Costo total</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-zinc-400">—</td>
                <td colSpan={6} />
              </tr>
            )}
            {margen != null && (
              <tr className="border-t border-zinc-100 bg-zinc-50">
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-zinc-500">$ Margen</td>
                <td className={`px-3 py-2 text-right text-sm font-semibold ${margen >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatImporte(margen, "MXN")}
                  {pctMargen != null && (
                    <span className="ml-1.5 text-xs font-normal">({pctMargen.toFixed(1)}%)</span>
                  )}
                </td>
                <td colSpan={6} />
              </tr>
            )}
          </tfoot>
        </table>
        </div>
      </div>

      {/* Modal: Reasignar */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Reasignar proveedor
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {modalReasignar.productoNombre} — actualmente:{" "}
                  {modalReasignar.proveedorNombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReasignar(null)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {modalReasignar.ofertasAlternativas.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No hay otros proveedores que hayan cotizado este material.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">
                    Selecciona el nuevo proveedor:
                  </p>
                  <div className="space-y-2">
                    {modalReasignar.ofertasAlternativas.map((o: any) => (
                      <label
                        key={o.proveedorId}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          nuevoProveedorId === o.proveedorId
                            ? "border-[var(--color-primario)] bg-[var(--color-primario)]/5"
                            : "border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="proveedor"
                          value={o.proveedorId}
                          checked={nuevoProveedorId === o.proveedorId}
                          onChange={() => setNuevoProveedorId(o.proveedorId)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            {o.proveedorNombre}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatImporte(o.precioUnitario, modalReasignar.moneda ?? "MXN")} · disp:{" "}
                            {o.cantidadDisponible} {modalReasignar.unidadMedida}{" "}
                            · R{o.ronda}
                          </p>
                          {!o.puedeCumplirFecha && o.fechaEstimadaEntrega && (
                            <p className="text-xs text-amber-600">
                              Entrega estimada:{" "}
                              {formatFecha(o.fechaEstimadaEntrega)}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalReasignar(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReasignar}
                disabled={!nuevoProveedorId || ejecutando}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50"
              >
                {ejecutando ? "Reasignando…" : "Confirmar reasignación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
