"use client";

import {
  IconMessageCircle,
  IconX,
} from "@tabler/icons-react";
import ChatWidget from "@/src/components/Chat/ChatWidget";
import { getMensajesNoLeidos } from "@/src/lib/chatActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import CountdownTimer from "@/src/components/CountdownTimer";
import { enviarOfertaAction } from "@/src/lib/ofertasActions";
import { formatImporte } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ItemDetalle = {
  licitacionItemId: string;
  nombre: string;
  unidadMedida: string;
  especificacion: string | null;
  cantidadSolicitada: number;
  fechaEntrega: string | null;
  moneda: string;
  oferta: {
    precioUnitario: number;
    cantidadDisponible: number;
    puedeCumplirFecha: boolean;
    fechaEstimadaEntrega: string | null;
  } | null;
  // Oferta del mismo proveedor en la ronda inmediatamente anterior — solo se
  // usa para pre-llenar los campos cuando aún no ha cotizado en la ronda actual.
  ofertaAnterior: {
    precioUnitario: number;
    cantidadDisponible: number;
    puedeCumplirFecha: boolean;
    fechaEstimadaEntrega: string | null;
  } | null;
};

type FilaState = {
  cantidadDisponible: string;
  precioUnitario: string;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

const INPUT_WARN =
  "w-full rounded-md border border-amber-400 bg-amber-50/40 px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-primary/30";

const INPUT_ERR =
  "w-full rounded-md border border-red-500 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-primary/30";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPeso(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LicitacionCotizacion({
  id,
  numero,
  jerarquia,
  tipoLicitacion,
  fechaEjecucion,
  fechaFinRangoEntrega,
  rondaActual,
  maxRondas,
  rondaFinMs,
  esperandoDecision,
  instrucciones: _instrucciones,
  proveedorId,
  basePath,
  items,
  noLeidosInicial = 0,
  nombreComprador = "Comprador",
}: {
  id: string;
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  fechaEjecucion: string | null;
  fechaFinRangoEntrega: string | null;
  rondaActual: number;
  maxRondas: number;
  rondaFinMs: number | null;
  esperandoDecision: boolean;
  instrucciones: string | null;
  proveedorId: string;
  basePath: string;
  items: ItemDetalle[];
  noLeidosInicial?: number;
  nombreComprador?: string;
}) {
  const router = useRouter();
  usePageTitle(`Licitación ${numero}`);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [noLeidos, setNoLeidos] = useState(noLeidosInicial);

  // Background polling for unread badge (even when chat is closed)
  useEffect(() => {
    if (!proveedorId) return;
    const poll = async () => {
      const count = await getMensajesNoLeidos(id, proveedorId, "proveedor");
      setNoLeidos(count);
    };
    const timerId = setInterval(poll, 30_000);
    return () => clearInterval(timerId);
  }, [id, proveedorId]);

  // Reset badge when chat opens
  function abrirChat() {
    setNoLeidos(0);
    setChatAbierto(true);
  }

  // ── Per-row editable state ────────────────────────────────────────────────
  // Fuente de pre-llenado: la oferta ya guardada en esta ronda si existe
  // (editando lo que ya envió), o si no, la de la ronda anterior (punto de
  // partida editable). En la primera ronda, sin oferta previa, se mantiene
  // el comportamiento original: cantidad = solicitada, precio vacío.
  const [filas, setFilas] = useState<FilaState[]>(() =>
    items.map((item: any) => {
      const base = item.oferta ?? item.ofertaAnterior;
      return {
        cantidadDisponible: base
          ? String(Math.min(base.cantidadDisponible, item.cantidadSolicitada))
          : String(item.cantidadSolicitada),
        precioUnitario: base ? String(base.precioUnitario) : "",
        puedeCumplirFecha: base ? base.puedeCumplirFecha : true,
        fechaEstimadaEntrega: base?.fechaEstimadaEntrega
          ? new Date(base.fechaEstimadaEntrega).toISOString().split("T")[0]
          : "",
      };
    })
  );

  // ── Round timer state ─────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (rondaFinMs === null) return;
    const tick = () => setRemaining(rondaFinMs - Date.now());
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [rondaFinMs]);

  // ── Tiempo extra state ────────────────────────────────────────────────────
  const [modoSoloLectura, setModoSoloLectura] = useState(false);
  const [tiempoExtraActivo, setTiempoExtraActivo] = useState(false);
  const [tiempoExtraRestante, setTiempoExtraRestante] = useState(60);
  const [notifAutoEnvio, setNotifAutoEnvio] = useState(false);
  const [canceloParticipacion, setCanceloParticipacion] = useState(false);
  const tiempoExtraDisparadoRef = useRef(false);

  // Detect when the round clock hits 0 while the user is watching
  useEffect(() => {
    if (
      remaining !== null &&
      remaining <= 0 &&
      !tiempoExtraDisparadoRef.current &&
      rondaActual > 0 &&
      !esperandoDecision &&
      !modoSoloLectura
    ) {
      tiempoExtraDisparadoRef.current = true;
      setTiempoExtraActivo(true);
      setTiempoExtraRestante(60);
    }
  }, [remaining, rondaActual, esperandoDecision, modoSoloLectura]);

  // Countdown for the extra minute
  useEffect(() => {
    if (!tiempoExtraActivo) return;
    const interval = setInterval(() => {
      setTiempoExtraRestante((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [tiempoExtraActivo]);

  // Stable ref so the auto-submit effect always calls the latest version
  const enviarFnRef = useRef<((auto: boolean) => Promise<void>) | undefined>(undefined);

  // Auto-submit when the extra minute expires
  useEffect(() => {
    if (tiempoExtraActivo && tiempoExtraRestante === 0) {
      enviarFnRef.current?.(true);
    }
  }, [tiempoExtraRestante, tiempoExtraActivo]);

  // ── Round open/closed ─────────────────────────────────────────────────────
  const rondaAbierta =
    !modoSoloLectura &&
    !esperandoDecision &&
    rondaActual > 0 &&
    (rondaFinMs === null || (remaining !== null && remaining > 0));

  const tieneOfertaPrevia = items.some((item) => item.oferta !== null);

  // ── Confirmation modal ────────────────────────────────────────────────────
  const [modalConfirm, setModalConfirm] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // ── Cantidad disponible validation ────────────────────────────────────────
  const rowErrors = items.map((item, idx) => {
    const val = parseFloat(filas[idx].cantidadDisponible);
    return filas[idx].cantidadDisponible !== "" &&
      !isNaN(val) &&
      val > item.cantidadSolicitada
      ? `La cantidad no puede superar la solicitada (${item.cantidadSolicitada} ${item.unidadMedida})`
      : null;
  });
  const hayErroresCantidad = rowErrors.some(Boolean);

  // ── Live totals per moneda ────────────────────────────────────────────────
  const totalesPorMoneda = useMemo(() => {
    return filas.reduce((acc, fila, idx) => {
      const moneda = items[idx].moneda ?? "MXN";
      const precio = parseFloat(fila.precioUnitario) || 0;
      const disponible = parseFloat(fila.cantidadDisponible) || 0;
      const solicitada = items[idx].cantidadSolicitada;
      acc[moneda] = (acc[moneda] ?? 0) + precio * Math.min(disponible, solicitada);
      return acc;
    }, {} as Record<string, number>);
  }, [filas, items]);
  const valorTotal = Object.values(totalesPorMoneda).reduce((s, v) => s + v, 0);

  // ── Row helpers ───────────────────────────────────────────────────────────
  function setFila(idx: number, campo: keyof FilaState, valor: string | boolean) {
    setFilas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [campo]: valor };
      return next;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function enviarOfertaAhora(autoEnvio: boolean) {
    setEnviando(true);
    try {
      await enviarOfertaAction(
        id,
        proveedorId,
        rondaActual,
        basePath,
        items.map((item, idx) => ({
          licitacionItemId: item.licitacionItemId,
          precioUnitario: parseFloat(filas[idx].precioUnitario) || 0,
          cantidadDisponible: parseFloat(filas[idx].cantidadDisponible) || 0,
          puedeCumplirFecha: filas[idx].puedeCumplirFecha,
          fechaEstimadaEntrega: filas[idx].puedeCumplirFecha
            ? null
            : filas[idx].fechaEstimadaEntrega || null,
        }))
      );
      setModalConfirm(false);
      setTiempoExtraActivo(false);
      setModoSoloLectura(true);
      if (autoEnvio) setNotifAutoEnvio(true);
    } finally {
      setEnviando(false);
    }
  }

  // Keep ref pointing to the latest closure so the auto-submit effect works
  enviarFnRef.current = enviarOfertaAhora;

  async function confirmarEnvio() {
    await enviarOfertaAhora(false);
  }

  function cancelarParticipacion() {
    setTiempoExtraActivo(false);
    setModoSoloLectura(true);
    setCanceloParticipacion(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-32">

      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/proveedor/licitaciones`}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              ← Mis Licitaciones
            </Link>
          </div>
          <p className="text-sm text-zinc-500">
            Ronda {rondaActual === 0 ? "—" : rondaActual} de {maxRondas}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {tiempoExtraActivo ? (
            <span className="animate-pulse font-semibold text-red-600">
              Tiempo extra
            </span>
          ) : esperandoDecision ? (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
              El comprador está revisando los resultados finales
            </span>
          ) : rondaFinMs === null ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-500">
              Por iniciar
            </span>
          ) : (
            <CountdownTimer fechaFin={new Date(rondaFinMs)} precision="seconds" className="text-lg" />
          )}
          <div className="relative">
            <button
              type="button"
              onClick={abrirChat}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <IconMessageCircle className="h-4 w-4" />
              Abrir Chat
            </button>
            {noLeidos > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
                {noLeidos > 9 ? "9+" : noLeidos}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Info cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Criticidad", valor: jerarquia ?? "—" },
          { label: "Comprador", valor: "Comprador 1" },
          { label: "Tipo de Compra", valor: tipoLicitacion ?? "—" },
          { label: "Inicio de Ronda", valor: formatFechaHora(fechaEjecucion) },
          { label: "Fecha Obj. Entrega", valor: formatFecha(fechaFinRangoEntrega) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-xs font-medium text-zinc-400">{card.label}</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-700">{card.valor}</p>
          </div>
        ))}
      </div>

      {/* ── Quotation table ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          {esperandoDecision
            ? "Tu última oferta enviada"
            : "Registrar oferta de precio por producto"}
        </h2>

        {/* Cancelled participation banner */}
        {canceloParticipacion && (
          <div className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            <span className="mt-px shrink-0">✗</span>
            <span>No participaste en esta ronda.</span>
          </div>
        )}

        {esperandoDecision && (
          <div className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            <span className="mt-px shrink-0">🔍</span>
            <span>
              El comprador está revisando los resultados finales de todas las rondas.
              No es posible modificar tu oferta en este momento.
            </span>
          </div>
        )}

        {!esperandoDecision && rondaActual === 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            <span className="mt-px shrink-0">🕐</span>
            <span>La ronda aún no ha comenzado. Espera a que el comprador inicie la licitación.</span>
          </div>
        )}

        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-center text-sm text-zinc-400">
            Esta licitación no tiene productos registrados.
          </div>
        )}

        {items.length > 0 && (
          <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="min-w-[180px] px-3 py-2.5">Producto</th>
                  <th className="min-w-[90px] px-3 py-2.5 text-right">Cant. Solic.</th>
                  <th className="min-w-[80px] px-3 py-2.5">Unidad</th>
                  <th className="min-w-[80px] px-3 py-2.5">Moneda</th>
                  <th className="min-w-[120px] px-3 py-2.5">Fecha Requerida</th>
                  <th className="min-w-[140px] px-3 py-2.5">Cant. Disponible</th>
                  <th className="min-w-[140px] px-3 py-2.5">Precio Unitario</th>
                  <th className="min-w-[160px] px-3 py-2.5">¿Cumples la fecha?</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  // ── Read-only when comprador reviews results ────────────────
                  if (esperandoDecision) {
                    const o = item.oferta;
                    return (
                      <Fragment key={item.licitacionItemId}>
                        <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors duration-150">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-zinc-800">{item.nombre}</p>
                            {item.especificacion && (
                              <p className="text-xs text-zinc-400">{item.especificacion}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-zinc-600">
                            {item.cantidadSolicitada}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-500">{item.unidadMedida}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                              {item.moneda}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600">
                            {formatFecha(item.fechaEntrega)}
                          </td>
                          {o ? (
                            <>
                              <td className="px-3 py-2.5 text-zinc-700">{o.cantidadDisponible}</td>
                              <td className="px-3 py-2.5 font-medium text-zinc-800">
                                {formatImporte(o.precioUnitario, item.moneda)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`text-sm font-medium ${
                                    o.puedeCumplirFecha ? "text-emerald-700" : "text-amber-600"
                                  }`}
                                >
                                  {o.puedeCumplirFecha ? "Sí" : "No"}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={3} className="px-3 py-2.5">
                              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                                No cotizó
                              </span>
                            </td>
                          )}
                        </tr>
                        {o && !o.puedeCumplirFecha && o.fechaEstimadaEntrega && (
                          <tr className="border-b border-zinc-100 last:border-0 bg-amber-50/30 hover:bg-zinc-50/50 transition-colors duration-150">
                            <td colSpan={8} className="px-3 pb-2.5 pt-0 text-xs text-amber-700 pl-5">
                              Fecha estimada de entrega: {formatFecha(o.fechaEstimadaEntrega)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }

                  // ── Editable row ───────────────────────────────────────────
                  const fila = filas[idx];
                  const disponible = parseFloat(fila.cantidadDisponible) || 0;
                  const rowError = rowErrors[idx];
                  const cantParcial =
                    !rowError &&
                    fila.cantidadDisponible !== "" &&
                    disponible < item.cantidadSolicitada &&
                    disponible >= 0;

                  return (
                    <Fragment key={item.licitacionItemId}>
                      <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors duration-150">
                        {/* Producto */}
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-zinc-800">{item.nombre}</p>
                          {item.especificacion && (
                            <p className="text-xs text-zinc-400">{item.especificacion}</p>
                          )}
                        </td>

                        {/* Cantidad solicitada */}
                        <td className="px-3 py-2.5 text-right text-zinc-600">
                          {item.cantidadSolicitada}
                        </td>

                        {/* Unidad */}
                        <td className="px-3 py-2.5 text-zinc-500">{item.unidadMedida}</td>

                        {/* Moneda */}
                        <td className="px-3 py-2.5">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {item.moneda}
                          </span>
                        </td>

                        {/* Fecha requerida */}
                        <td className="px-3 py-2.5 text-zinc-600">
                          {formatFecha(item.fechaEntrega)}
                        </td>

                        {/* Cantidad disponible */}
                        <td className="px-3 py-2.5">
                          {rondaAbierta ? (
                            <input
                              type="number"
                              min="0"
                              max={item.cantidadSolicitada}
                              step="any"
                              value={fila.cantidadDisponible}
                              onChange={(e) =>
                                setFila(idx, "cantidadDisponible", e.target.value)
                              }
                              className={
                                rowError
                                  ? INPUT_ERR
                                  : cantParcial
                                    ? INPUT_WARN
                                    : INPUT
                              }
                              placeholder="0"
                            />
                          ) : rondaActual === 0 ? (
                            <input
                              type="number"
                              disabled
                              placeholder="—"
                              className={`${INPUT} cursor-not-allowed opacity-40`}
                            />
                          ) : (
                            <span className="text-zinc-700">
                              {fila.cantidadDisponible || "—"}
                            </span>
                          )}
                        </td>

                        {/* Precio unitario */}
                        <td className="px-3 py-2.5">
                          {rondaAbierta ? (
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                                $
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={fila.precioUnitario}
                                onChange={(e) =>
                                  setFila(idx, "precioUnitario", e.target.value)
                                }
                                className={`${INPUT} pl-7`}
                                placeholder="0.00"
                              />
                            </div>
                          ) : rondaActual === 0 ? (
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400 opacity-40">
                                $
                              </span>
                              <input
                                type="number"
                                disabled
                                placeholder="—"
                                className={`${INPUT} pl-7 cursor-not-allowed opacity-40`}
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-700">
                              {fila.precioUnitario
                                ? formatImporte(parseFloat(fila.precioUnitario), item.moneda)
                                : "—"}
                            </span>
                          )}
                        </td>

                        {/* ¿Cumples la fecha? */}
                        <td className="px-3 py-2.5">
                          {rondaAbierta ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFila(idx, "puedeCumplirFecha", true)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                  fila.puedeCumplirFecha
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                }`}
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setFila(idx, "puedeCumplirFecha", false)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                  !fila.puedeCumplirFecha
                                    ? "bg-red-100 text-red-700"
                                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                }`}
                              >
                                No
                              </button>
                            </div>
                          ) : rondaActual === 0 ? (
                            <div className="flex items-center gap-1 opacity-40">
                              <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`text-sm font-medium ${fila.puedeCumplirFecha ? "text-emerald-700" : "text-red-600"}`}
                            >
                              {fila.puedeCumplirFecha ? "Sí" : "No"}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Error row — cantidad excede máximo */}
                      {rowError && (
                        <tr className="border-b border-zinc-100 last:border-0 bg-red-50/40 hover:bg-zinc-50/50 transition-colors duration-150">
                          <td colSpan={8} className="px-3 pb-2.5 pt-0 text-xs text-red-600">
                            ✕ {rowError}
                          </td>
                        </tr>
                      )}

                      {/* Warning row — cantidad parcial */}
                      {cantParcial && (
                        <tr className="border-b border-zinc-100 last:border-0 bg-amber-50/30 hover:bg-zinc-50/50 transition-colors duration-150">
                          <td colSpan={8} className="px-3 pb-2.5 pt-0 text-xs text-amber-700">
                            ⚠ Disponible menor a lo solicitado — se completará con otro proveedor
                          </td>
                        </tr>
                      )}

                      {/* Fecha estimada entrega row — when "No" selected */}
                      {!fila.puedeCumplirFecha && rondaAbierta && (
                        <tr className="border-b border-zinc-100 last:border-0 bg-zinc-50/60 hover:bg-zinc-50/50 transition-colors duration-150">
                          <td colSpan={8} className="px-3 pb-2.5 pt-0">
                            <div className="flex items-center gap-2 pl-2">
                              <label className="text-xs font-medium text-zinc-600 whitespace-nowrap">
                                Fecha estimada de entrega
                                <span className="text-red-500"> *</span>
                              </label>
                              <input
                                type="date"
                                value={fila.fechaEstimadaEntrega}
                                onChange={(e) =>
                                  setFila(idx, "fechaEstimadaEntrega", e.target.value)
                                }
                                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Read-only fecha estimada when closed */}
                      {!fila.puedeCumplirFecha && !rondaAbierta && fila.fechaEstimadaEntrega && (
                        <tr className="border-b border-zinc-100 last:border-0 bg-zinc-50/60 hover:bg-zinc-50/50 transition-colors duration-150">
                          <td colSpan={8} className="px-3 pb-2.5 pt-0 text-xs text-zinc-500 pl-5">
                            Fecha estimada de entrega: {formatFecha(fila.fechaEstimadaEntrega)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar ────────────────────────────────────────────── */}
      {!esperandoDecision && rondaActual > 0 && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-sm px-8 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-zinc-400">Valor Total de Propuesta</p>
              {Object.entries(totalesPorMoneda).map(([moneda, total]) => (
                <p key={moneda} className="text-2xl font-bold text-[var(--color-primario)]">
                  {formatImporte(total as number, moneda)}
                </p>
              ))}
              {Object.keys(totalesPorMoneda).length === 0 && (
                <p className="text-2xl font-bold text-zinc-300">—</p>
              )}
            </div>

            {rondaAbierta ? (
              <button
                type="button"
                onClick={() => setModalConfirm(true)}
                disabled={hayErroresCantidad}
                className="rounded-md bg-[var(--color-primario)] px-6 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tieneOfertaPrevia ? "Actualizar Oferta" : "Enviar Oferta"}
              </button>
            ) : (
              <span className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
                Esta ronda ha cerrado
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Normal confirmation modal ─────────────────────────────────────── */}
      {modalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">
                Confirmar envío de oferta
              </h2>
              <button
                type="button"
                onClick={() => setModalConfirm(false)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              ¿Confirmas el envío de tu oferta por{" "}
              {Object.entries(totalesPorMoneda).map(([moneda, total], i) => (
                <span key={moneda}>
                  {i > 0 && " + "}
                  <span className="font-semibold text-zinc-900">{formatImporte(total as number, moneda)}</span>
                </span>
              ))}?{" "}
              Podrás modificarla mientras la ronda actual siga abierta.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalConfirm(false)}
                disabled={enviando}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEnvio}
                disabled={enviando}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-60"
              >
                {enviando ? "Enviando…" : "Confirmar y Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extra time modal (cannot be dismissed) ───────────────────────── */}
      {tiempoExtraActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Pulsing red header */}
            <div className="flex animate-pulse items-center gap-2 bg-red-600 px-5 py-3">
              <span className="text-lg text-white">⚠</span>
              <p className="text-sm font-semibold text-white">La ronda ha terminado</p>
            </div>

            <div className="space-y-5 p-6">
              <p className="text-sm text-zinc-700">
                Tienes{" "}
                <span className="font-semibold text-red-600">1 minuto adicional</span>{" "}
                para completar tu oferta.
              </p>

              {/* Countdown */}
              <div className="text-center">
                <span className="tabular-nums text-5xl font-bold text-red-600">
                  0:{String(tiempoExtraRestante).padStart(2, "0")}
                </span>
              </div>

              {/* Primary action */}
              <button
                type="button"
                onClick={() => enviarOfertaAhora(false)}
                disabled={enviando}
                className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {enviando ? "Enviando…" : "Enviar mi oferta ahora"}
              </button>

              {/* Secondary action */}
              <button
                type="button"
                onClick={cancelarParticipacion}
                disabled={enviando}
                className="w-full text-xs text-red-400 transition-colors hover:text-red-600 disabled:opacity-50"
              >
                Cancelar y no participar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat modal ───────────────────────────────────────────────────────── */}
      {chatAbierto && proveedorId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center"
          onClick={() => setChatAbierto(false)}
        >
          <div
            className="flex h-[560px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">Chat</p>
                <h2 className="text-sm font-semibold text-zinc-900">
                  {nombreComprador}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setChatAbierto(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWidget
                licitacionId={id}
                proveedorId={proveedorId}
                emisor="proveedor"
                nombreProveedor={nombreComprador}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-submit notification toast ───────────────────────────────── */}
      {notifAutoEnvio && (
        <div className="fixed bottom-6 right-6 z-50 w-80 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
          <p className="text-sm font-semibold text-zinc-900">
            Oferta enviada automáticamente
          </p>
          <p className="text-xs text-zinc-500">
            Tu oferta fue enviada automáticamente con los datos que habías capturado.
            ¿Deseas revisar tu oferta enviada?
          </p>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setNotifAutoEnvio(false);
                router.refresh();
              }}
              className="text-xs font-medium text-[var(--color-primario)] hover:underline"
            >
              Ver mi oferta
            </button>
            <button
              type="button"
              onClick={() => setNotifAutoEnvio(false)}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
