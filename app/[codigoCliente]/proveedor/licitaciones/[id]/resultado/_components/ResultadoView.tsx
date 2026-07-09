"use client";

import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconDownload,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  confirmarAsignacionProveedorAction,
  rechazarAsignacionProveedorAction,
} from "@/src/lib/proveedorAsignacionActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import type { AsignacionProveedor, LicitacionResultado } from "../page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeso(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function CountdownHeader({ limiteMs }: { limiteMs: number }) {
  const [ms, setMs] = useState(() => Math.max(0, limiteMs - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setMs(Math.max(0, limiteMs - Date.now())), 1000);
    return () => clearInterval(id);
  }, [limiteMs]);

  if (ms === 0)
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-red-100 px-3.5 py-1.5 text-sm font-semibold text-red-700">
        <IconClock className="h-4 w-4" />
        Tiempo vencido
      </span>
    );

  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const text =
    h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m para confirmar`
      : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s para confirmar`;

  const esUrgente = totalSecs < 3600;
  const color = esUrgente
    ? "bg-red-100 text-red-700"
    : totalSecs < 7200
      ? "bg-amber-100 text-amber-700"
      : "bg-zinc-100 text-zinc-600";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${color} ${
        esUrgente ? "animate-pulse" : ""
      }`}
    >
      <IconClock className="h-4 w-4" />
      {text}
    </span>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function generarPDF(
  licitacion: LicitacionResultado,
  asignaciones: AsignacionProveedor[],
  proveedorNombre: string
) {
  const confirmadas = asignaciones.filter(
    (a) => a.estatusProveedor === "Confirmado" || a.estatusProveedor === "Aprobado"
  );
  const total = confirmadas.reduce(
    (sum: any, a: any) => sum + a.cantidadAsignada * a.precioUnitario,
    0
  );

  const filas = confirmadas
    .map(
      (a) => `
      <tr>
        <td>${a.productoNombre}</td>
        <td style="text-align:right">${a.cantidadAsignada}</td>
        <td>${a.unidadMedida}</td>
        <td style="text-align:right">${formatPeso(a.precioUnitario)}</td>
        <td>${formatFecha(a.fechaObjetivo)}</td>
        <td>${a.fechaEstimadaProveedor ? formatFecha(a.fechaEstimadaProveedor) : "Sí cumple"}</td>
        <td style="text-align:right">${formatPeso(a.cantidadAsignada * a.precioUnitario)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Resultado Licitación ${licitacion.numero}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111}
      h1{font-size:18px;margin-bottom:4px}
      .sub{color:#666;font-size:11px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#f4f4f4;text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;font-size:11px}
      td{padding:6px 8px;border-bottom:1px solid #eee}
      .total{text-align:right;margin-top:12px;font-weight:bold;font-size:13px}
    </style></head><body>
    <h1>Licitación ${licitacion.numero}</h1>
    <div class="sub">
      Proveedor: ${proveedorNombre} &nbsp;|&nbsp; Criticidad: ${licitacion.jerarquia ?? "—"}
    </div>
    <table>
      <thead>
        <tr>
          <th>Material</th><th>Cant.</th><th>U.M.</th>
          <th>Precio Unit.</th><th>Fecha Objetivo</th><th>Fecha Estimada</th><th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="total">Total confirmado: ${formatPeso(total)}</div>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.print();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultadoView({
  licitacion,
  asignaciones,
  proveedorNombre,
  basePath,
}: {
  licitacion: LicitacionResultado;
  asignaciones: AsignacionProveedor[];
  proveedorNombre: string;
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle(licitacion.numero);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<{ id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);

  const ahora = Date.now();
  const pendientes = asignaciones.filter((a) => a.estatusProveedor === "Pendiente");
  const hayConfirmados = asignaciones.some(
    (a) => a.estatusProveedor === "Confirmado" || a.estatusProveedor === "Aprobado"
  );
  const todasResueltas =
    asignaciones.length > 0 &&
    asignaciones.every(
      (a) => a.estatusProveedor === "Confirmado" || a.estatusProveedor === "Aprobado" || a.estatusProveedor === "Rechazado"
    );

  // Tiempo límite más próximo entre pendientes (para el header)
  const limitePendientesMs = pendientes
    .map((a: any) => (a.fechaLimiteConfirmacion ? new Date(a.fechaLimiteConfirmacion).getTime() : null))
    .filter((ms): ms is number => ms !== null)
    .sort((a: any, b: any) => a - b)[0] ?? null;

  async function handleConfirmar(asignacionId: string) {
    setConfirmando(asignacionId);
    try {
      await confirmarAsignacionProveedorAction(asignacionId, licitacion.id, basePath);
      router.refresh();
    } finally {
      setConfirmando(null);
    }
  }

  async function handleRechazar() {
    if (!rechazando || !motivo.trim()) return;
    setProcesando(true);
    try {
      await rechazarAsignacionProveedorAction(
        rechazando.id,
        motivo.trim(),
        licitacion.id,
        basePath
      );
      setRechazando(null);
      setMotivo("");
      router.refresh();
    } finally {
      setProcesando(false);
    }
  }

  const ESTATUS_BADGE: Record<string, React.ReactNode> = {
    Pendiente: (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
        <IconClock className="h-3 w-3" />
        Pendiente
      </span>
    ),
    Confirmado: (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        <IconCircleCheck className="h-3 w-3" />
        Confirmado
      </span>
    ),
    Aprobado: (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        <IconCircleCheck className="h-3 w-3" />
        Aprobado
      </span>
    ),
    Rechazado: (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <IconX className="h-3 w-3" />
        Rechazado
      </span>
    ),
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href={`${basePath}/proveedor/licitaciones`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Mis Licitaciones
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              <IconTrophy className="h-4 w-4" />
              Ganador
            </span>
            {limitePendientesMs && !todasResueltas && (
              <CountdownHeader limiteMs={limitePendientesMs} />
            )}
            {todasResueltas && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <IconCircleCheck className="h-3.5 w-3.5" />
                Respondido
              </span>
            )}
          </div>
          {licitacion.jerarquia && (
            <p className="text-sm text-zinc-500">{licitacion.jerarquia}</p>
          )}
        </div>

        <button
          type="button"
          disabled={!hayConfirmados}
          onClick={() => generarPDF(licitacion, asignaciones, proveedorNombre)}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconDownload className="h-4 w-4" />
          Descargar PDF
        </button>
      </div>

      {/* Tabla de materiales */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="min-w-[180px] px-4 py-3">Material</th>
              <th className="min-w-[90px] px-4 py-3 text-right">Cantidad</th>
              <th className="min-w-[70px] px-4 py-3">U.M.</th>
              <th className="min-w-[110px] px-4 py-3 text-right">Precio unit.</th>
              <th className="min-w-[110px] px-4 py-3 text-right">Subtotal</th>
              <th className="min-w-[120px] px-4 py-3">Fecha objetivo</th>
              <th className="min-w-[120px] px-4 py-3">Fecha estimada</th>
              <th className="min-w-[120px] px-4 py-3">Estatus</th>
              <th className="min-w-[160px] px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {asignaciones.map((a: any)=> {
              const limiteMs = a.fechaLimiteConfirmacion
                ? new Date(a.fechaLimiteConfirmacion).getTime()
                : null;
              const vencido = limiteMs !== null && ahora > limiteMs;
              const isPendiente = a.estatusProveedor === "Pendiente";
              const isProcessing = confirmando === a.id;

              return (
                <tr key={a.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {a.productoNombre}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{a.cantidadAsignada}</td>
                  <td className="px-4 py-3 text-zinc-500">{a.unidadMedida}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">
                    {formatPeso(a.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-800">
                    {formatPeso(a.cantidadAsignada * a.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatFecha(a.fechaObjetivo)}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {a.fechaEstimadaProveedor ? (
                      <span className="text-amber-600">{formatFecha(a.fechaEstimadaProveedor)}</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">Cumple fecha</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ESTATUS_BADGE[a.estatusProveedor] ?? (
                      <span className="text-zinc-400">{a.estatusProveedor}</span>
                    )}
                    {a.motivoRechazo && (
                      <p className="mt-1 text-xs text-zinc-400 italic">{a.motivoRechazo}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isPendiente && vencido && (
                      <span className="text-xs text-red-500">
                        El tiempo para confirmar ha vencido
                      </span>
                    )}
                    {isPendiente && !vencido && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleConfirmar(a.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                          {isProcessing ? "..." : "Confirmar"}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            setRechazando({ id: a.id, nombre: a.productoNombre })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 disabled:opacity-50"
                        >
                          <IconX className="h-3.5 w-3.5" />
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals */}
          <tfoot>
            <tr className="border-t-2 border-zinc-200 bg-zinc-50">
              <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                {formatPeso(
                  asignaciones.reduce(
                    (sum: any, a: any) => sum + a.cantidadAsignada * a.precioUnitario,
                    0
                  )
                )}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* Modal: Rechazar */}
      {rechazando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Rechazar material</h2>
                <p className="text-xs text-zinc-500">{rechazando.nombre}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRechazando(null);
                  setMotivo("");
                }}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Motivo del rechazo
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Escribe el motivo por el que no puedes suministrar este material..."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setRechazando(null);
                  setMotivo("");
                }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!motivo.trim() || procesando}
                onClick={handleRechazar}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {procesando ? "Enviando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
