"use client";

import {
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconFileText,
  IconTrophy,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LicitacionEnProceso,
  LicitacionFinalizada,
  LicitacionProgramada,
  SubEstadoFinalizada,
} from "../page";
import CountdownTimer from "@/src/components/CountdownTimer";
import PanelFiltros from "@/app/_components/PanelFiltros";
import EmptyState from "@/src/components/EmptyState";

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
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} ${hora}`;
}

// ── Countdown para filas de Programadas ──────────────────────────────────────

function ProgramadaRow({
  l,
  basePath,
  onModal,
}: {
  l: LicitacionProgramada;
  basePath: string;
  onModal: (m: { numero: string; instrucciones: string | null }) => void;
}) {
  const router = useRouter();
  const targetMs = l.fechaEjecucion ? new Date(l.fechaEjecucion).getTime() : null;
  const [ms, setMs] = useState<number | null>(() =>
    targetMs !== null ? Math.max(0, targetMs - Date.now()) : null
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (targetMs === null) return;
    function tick() {
      const remaining = Math.max(0, targetMs! - Date.now());
      setMs(remaining);
      if (remaining > 0) {
        const delay = remaining < 3_600_000 ? 1000 : 60_000;
        timerRef.current = setTimeout(tick, delay);
      }
    }
    const initial = targetMs - Date.now();
    const delay = initial < 3_600_000 ? 1000 : 60_000;
    timerRef.current = setTimeout(tick, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [targetMs]);

  const urgencia =
    ms === null || ms === 0 ? null
    : ms < 3 * 3_600_000 ? "red"
    : ms < 24 * 3_600_000 ? "amber"
    : null;

  let countdownNode: React.ReactNode;
  if (ms === null) {
    countdownNode = <span className="text-zinc-300">—</span>;
  } else if (ms === 0) {
    countdownNode = <span className="font-medium text-emerald-600">Iniciando...</span>;
  } else {
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86_400);
    const hours = Math.floor((totalSecs % 86_400) / 3_600);
    const mins = Math.floor((totalSecs % 3_600) / 60);
    const secs = totalSecs % 60;
    const text =
      days > 0 ? `${days}d ${hours}h ${String(mins).padStart(2, "0")}m`
      : hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m`
      : `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
    const color = ms < 3 * 3_600_000 ? "text-red-600" : ms < 24 * 3_600_000 ? "text-amber-600" : "text-zinc-700";
    countdownNode = <span className={`font-mono text-sm font-medium ${color}`}>{text}</span>;
  }

  const CELL = "px-4 py-3";
  return (
    <tr
      onClick={() => router.push(`${basePath}/proveedor/licitaciones/${l.id}`)}
      className="cursor-pointer hover:bg-zinc-50/50 transition-colors duration-150"
    >
      <td className="pl-3 pr-0 py-3 w-8">
        {urgencia === "red" && (
          <span
            title="Urgente: inicia en menos de 3 horas"
            className="flex h-3 w-3 shrink-0 rounded-full bg-red-500 ring-4 ring-red-100 animate-pulse"
          />
        )}
        {urgencia === "amber" && (
          <span
            title="Pronto: inicia en menos de 24 horas"
            className="flex h-3 w-3 shrink-0 rounded-full bg-amber-400 ring-4 ring-amber-100"
          />
        )}
        {urgencia === null && ms !== null && ms > 0 && (
          <span
            title="En tiempo"
            className="flex h-3 w-3 shrink-0 rounded-full bg-green-500 ring-4 ring-green-100"
          />
        )}
      </td>
      <td className={`${CELL} font-medium text-zinc-800`}>{l.numero}</td>
      <td className={`${CELL} text-zinc-600`}>{formatFecha(l.fechaCreacion)}</td>
      <td className={`${CELL} text-zinc-600`}>{formatFechaHora(l.fechaEjecucion)}</td>
      <td className={`${CELL} text-zinc-600`}>{l.jerarquia ?? "—"}</td>
      <td className={`${CELL} text-zinc-600`}>Comprador</td>
      <td className={`${CELL} text-zinc-600`}>{formatFecha(l.fechaFinRangoEntrega)}</td>
      <td className={`${CELL} text-center`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primario)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primario)]">
          <IconUsers className="h-3.5 w-3.5" />
          {l.totalParticipantes}
        </span>
      </td>
      <td className={`${CELL} text-center`}>{countdownNode}</td>
      <td className={CELL}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onModal({ numero: l.numero, instrucciones: l.instrucciones }); }}
          title="Ver instrucciones"
          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <IconFileText className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Sub-estado badge ──────────────────────────────────────────────────────────

function SubEstadoBadge({
  sub,
  confirmacionDeadlineMs,
}: {
  sub: SubEstadoFinalizada;
  confirmacionDeadlineMs: number | null;
}) {
  switch (sub) {
    case "en_espera":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
          <IconClock className="h-3.5 w-3.5" />
          En espera
        </span>
      );
    case "ganador":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <IconTrophy className="h-3.5 w-3.5" />
          Ganador
        </span>
      );
    case "pendiente_confirmacion":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <IconClock className="h-3.5 w-3.5 shrink-0" />
          <span>Ganador · Pendiente</span>
          {confirmacionDeadlineMs !== null && (
            <>
              <span className="text-blue-300">·</span>
              <CountdownTimer fechaFin={new Date(confirmacionDeadlineMs)} precision="minutes" />
            </>
          )}
        </span>
      );
    case "no_seleccionado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-500">
          <IconX className="h-3.5 w-3.5" />
          No seleccionado
        </span>
      );
    case "completado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          <IconTrophy className="h-3.5 w-3.5" />
          <IconCircleCheck className="h-3.5 w-3.5" />
          Ganador · Confirmado
        </span>
      );
  }
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({ active, count, label, onClick }: {
  active: boolean; count: number; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus:outline-none ${
        active
          ? "border-b-2 border-[var(--color-primario)] text-[var(--color-primario)]"
          : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          active
            ? "bg-[var(--color-primario)]/15 text-[var(--color-primario)]"
            : "bg-zinc-100 text-zinc-500"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Vacío ─────────────────────────────────────────────────────────────────────

function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <EmptyState icon="IconClipboardOff" title="Sin licitaciones" description={mensaje} />
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

type Tab = "programadas" | "en_proceso" | "finalizadas";
type ModalInstrucciones = { numero: string; instrucciones: string | null } | null;

const GANADAS: SubEstadoFinalizada[] = ["ganador", "pendiente_confirmacion", "completado"];

function desdeMs(periodo: string, fechaDesde: string): number | null {
  const now = Date.now();
  switch (periodo) {
    case "semana":   return now - 7 * 24 * 60 * 60 * 1000;
    case "mes":      return now - 30 * 24 * 60 * 60 * 1000;
    case "3meses":   return now - 90 * 24 * 60 * 60 * 1000;
    case "personalizado": return fechaDesde ? new Date(fechaDesde).getTime() : null;
    default: return null;
  }
}

function hastaMs(periodo: string, fechaHasta: string): number | null {
  if (periodo === "personalizado") {
    return fechaHasta ? new Date(fechaHasta + "T23:59:59").getTime() : null;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MisLicitacionesTabla({
  programadas,
  enProceso,
  finalizadas,
  basePath,
}: {
  programadas: LicitacionProgramada[];
  enProceso: LicitacionEnProceso[];
  finalizadas: LicitacionFinalizada[];
  basePath: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => {
    if (programadas.length > 0) return "programadas";
    if (enProceso.length > 0) return "en_proceso";
    return "programadas";
  });
  const [modal, setModal] = useState<ModalInstrucciones>(null);

  // ── Filtros del tab Finalizadas ───────────────────────────────────────────
  const [filtroTextFin, setFiltroTextFin] = useState("");
  const [filtroResultado, setFiltroResultado] = useState("");      // "" = Todas
  const [filtroJerarquiaFin, setFiltroJerarquiaFin] = useState(""); // "" = Todas
  const [filtroPeriodo, setFiltroPeriodo] = useState("semana");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");

  function limpiarFiltrosFin() {
    setFiltroResultado("");
    setFiltroJerarquiaFin("");
    setFiltroPeriodo("semana");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
  }

  // Jerarquías únicas de finalizadas para el panel de filtros
  const jerarquiasFin = useMemo(() => {
    return [...new Set(finalizadas.map((l: any) => l.jerarquia).filter((j): j is string => !!j))].sort();
  }, [finalizadas]);

  // ── Filtrado de finalizadas ───────────────────────────────────────────────
  const dMs = desdeMs(filtroPeriodo, filtroFechaDesde);
  const hMs = hastaMs(filtroPeriodo, filtroFechaHasta);

  const finFiltradas = finalizadas.filter((l) => {
    // Texto libre
    const q = filtroTextFin.toLowerCase();
    if (q && !l.numero.toLowerCase().includes(q) && !(l.jerarquia ?? "").toLowerCase().includes(q)) return false;
    // Jerarquía
    if (filtroJerarquiaFin && l.jerarquia !== filtroJerarquiaFin) return false;
    // Resultado
    if (filtroResultado) {
      const match = filtroResultado === "ganadas"
        ? GANADAS.includes(l.subEstado)
        : l.subEstado === filtroResultado;
      if (!match) return false;
    }
    // Período
    if (dMs !== null || hMs !== null) {
      const fechaEjec = l.fechaEjecucion ? new Date(l.fechaEjecucion).getTime() : null;
      if (fechaEjec !== null) {
        if (dMs !== null && fechaEjec < dMs) return false;
        if (hMs !== null && fechaEjec > hMs) return false;
      }
    }
    return true;
  });

  const CELL = "px-4 py-3";

  return (
    <div className="space-y-0">
      {/* Tab header */}
      <div className="flex border-b border-zinc-200">
        <TabBtn
          active={tab === "programadas"}
          count={programadas.length}
          label="Programadas"
          onClick={() => setTab("programadas")}
        />
        <TabBtn
          active={tab === "en_proceso"}
          count={enProceso.length}
          label="En Proceso"
          onClick={() => setTab("en_proceso")}
        />
        <TabBtn
          active={tab === "finalizadas"}
          count={finFiltradas.length}
          label="Finalizadas"
          onClick={() => setTab("finalizadas")}
        />
      </div>

      {/* ── TAB 1: Programadas ────────────────────────────────────────────── */}
      {tab === "programadas" && (
        <>
          {programadas.length === 0 ? (
            <Vacio mensaje="No tienes licitaciones programadas" />
          ) : (
            <div className="mt-4 rounded-card border border-border bg-white shadow-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="w-8 px-3 py-3" />
                    <th className="min-w-[130px] px-4 py-3">Número</th>
                    <th className="min-w-[110px] px-4 py-3">Fecha Licitación</th>
                    <th className="min-w-[150px] px-4 py-3">Inicio de Licitación</th>
                    <th className="min-w-[120px] px-4 py-3">Criticidad</th>
                    <th className="min-w-[100px] px-4 py-3">Comprador</th>
                    <th className="min-w-[120px] px-4 py-3">Fecha Obj. Entrega</th>
                    <th className="min-w-[100px] px-4 py-3 text-center">Participantes</th>
                    <th className="min-w-[140px] px-4 py-3 text-center">Tiempo para inicio</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {programadas.map((l: any) => (
                    <ProgramadaRow key={l.id} l={l} basePath={basePath} onModal={setModal} />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: En Proceso ─────────────────────────────────────────────── */}
      {tab === "en_proceso" && (
        <>
          {enProceso.length === 0 ? (
            <Vacio mensaje="No tienes licitaciones en proceso" />
          ) : (
            <div className="mt-4 rounded-card border border-border bg-white shadow-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="min-w-[130px] px-4 py-3">Número</th>
                    <th className="min-w-[110px] px-4 py-3">Fecha</th>
                    <th className="min-w-[150px] px-4 py-3">Inicio de Licitación</th>
                    <th className="min-w-[120px] px-4 py-3">Criticidad</th>
                    <th className="min-w-[100px] px-4 py-3">Comprador</th>
                    <th className="min-w-[110px] px-4 py-3 text-center">Ronda</th>
                    <th className="min-w-[130px] px-4 py-3 text-center">Tiempo restante</th>
                    <th className="min-w-[120px] px-4 py-3 text-center">Mi oferta</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {enProceso.map((l: any) => (
                    <tr
                      key={l.id}
                      onClick={() => router.push(`${basePath}/proveedor/licitaciones/${l.id}`)}
                      className="cursor-pointer hover:bg-zinc-50/50 transition-colors duration-150"
                    >
                      <td className={`${CELL} font-medium text-zinc-800`}>{l.numero}</td>
                      <td className={`${CELL} text-zinc-600`}>{formatFecha(l.fechaCreacion)}</td>
                      <td className={`${CELL} text-zinc-600`}>{formatFechaHora(l.fechaEjecucion)}</td>
                      <td className={`${CELL} text-zinc-600`}>{l.jerarquia ?? "—"}</td>
                      <td className={`${CELL} text-zinc-600`}>Comprador</td>
                      <td className={`${CELL} text-center`}>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                          Ronda {l.rondaActual} de {l.maxRondas}
                        </span>
                      </td>
                      <td className={`${CELL} text-center`}>
                        {l.esperandoDecision ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                            <IconAlertCircle className="h-3.5 w-3.5" />
                            Revisando
                          </span>
                        ) : l.rondaFinMs ? (
                          <CountdownTimer fechaFin={new Date(l.rondaFinMs)} precision="minutes" />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className={`${CELL} text-center`}>
                        {!l.esperandoDecision &&
                          (l.cotizóEnRondaActual ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              <IconCircleCheck className="h-3.5 w-3.5" />
                              Ya cotizé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              <IconClock className="h-3.5 w-3.5" />
                              Pendiente
                            </span>
                          ))}
                      </td>
                      <td className={CELL}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModal({ numero: l.numero, instrucciones: l.instrucciones }); }}
                          title="Ver instrucciones"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <IconFileText className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 3: Finalizadas ────────────────────────────────────────────── */}
      {tab === "finalizadas" && (
        <>
          {/* Barra de filtros: búsqueda + panel */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Buscar por número o criticidad…"
              value={filtroTextFin}
              onChange={(e) => setFiltroTextFin(e.target.value)}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <PanelFiltros
              secciones={[
                {
                  tipo: "select" as const,
                  titulo: "Resultado",
                  opciones: [
                    { label: "Todas", value: "" },
                    { label: "Ganadas", value: "ganadas" },
                    { label: "Pendiente de confirmación", value: "pendiente_confirmacion" },
                    { label: "En espera de resultado", value: "en_espera" },
                    { label: "No seleccionadas", value: "no_seleccionado" },
                  ],
                  valor: filtroResultado,
                  onCambio: setFiltroResultado,
                },
                ...(jerarquiasFin.length > 0
                  ? [{
                      tipo: "select" as const,
                      titulo: "Criticidad",
                      opciones: [
                        { label: "Todas", value: "" },
                        ...jerarquiasFin.map((j) => ({ label: j, value: j })),
                      ],
                      valor: filtroJerarquiaFin,
                      onCambio: setFiltroJerarquiaFin,
                    }]
                  : []),
                {
                  tipo: "select" as const,
                  titulo: "Fecha de finalización",
                  opciones: [
                    { label: "Última semana", value: "semana" },
                    { label: "Último mes", value: "mes" },
                    { label: "Últimos 3 meses", value: "3meses" },
                    { label: "Rango personalizado", value: "personalizado" },
                  ],
                  valor: filtroPeriodo,
                  onCambio: setFiltroPeriodo,
                  fechaDesde: filtroFechaDesde,
                  fechaHasta: filtroFechaHasta,
                  onFechaDesde: setFiltroFechaDesde,
                  onFechaHasta: setFiltroFechaHasta,
                },
              ]}
              onLimpiar={limpiarFiltrosFin}
            />
          </div>

          {finFiltradas.length === 0 ? (
            <Vacio
              mensaje={
                filtroTextFin || filtroResultado || filtroJerarquiaFin
                  ? "Sin resultados para los filtros seleccionados"
                  : "No tienes licitaciones finalizadas en el período seleccionado"
              }
            />
          ) : (
            <div className="mt-4 rounded-card border border-border bg-white shadow-card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                    <th className="min-w-[130px] px-4 py-3">Número</th>
                    <th className="min-w-[110px] px-4 py-3">Fecha</th>
                    <th className="min-w-[120px] px-4 py-3">Criticidad</th>
                    <th className="min-w-[100px] px-4 py-3">Comprador</th>
                    <th className="min-w-[90px] px-4 py-3">Estado</th>
                    <th className="min-w-[220px] px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {finFiltradas.map((l: any) => {
                    const href =
                      l.subEstado === "ganador" ||
                      l.subEstado === "pendiente_confirmacion" ||
                      l.subEstado === "completado"
                        ? `${basePath}/proveedor/licitaciones/${l.id}/resultado`
                        : `${basePath}/proveedor/licitaciones/${l.id}`;
                    return (
                      <tr
                        key={l.id}
                        onClick={() => router.push(href)}
                        className="cursor-pointer hover:bg-zinc-50/50 transition-colors duration-150"
                      >
                        <td className={`${CELL} font-medium text-zinc-800`}>{l.numero}</td>
                        <td className={`${CELL} text-zinc-600`}>{formatFecha(l.fechaEjecucion)}</td>
                        <td className={`${CELL} text-zinc-600`}>{l.jerarquia ?? "—"}</td>
                        <td className={`${CELL} text-zinc-600`}>Comprador</td>
                        <td className={CELL}>
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                            {l.estado}
                          </span>
                        </td>
                        <td className={CELL}>
                          <SubEstadoBadge
                            sub={l.subEstado}
                            confirmacionDeadlineMs={l.confirmacionDeadlineMs}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Instrucciones */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Instrucciones de la Licitación
                </h2>
                <p className="text-xs text-zinc-500">{modal.numero}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-md p-1 text-zinc-400 hover:text-zinc-700">
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">
              {modal.instrucciones ? (
                <p className="whitespace-pre-wrap text-sm text-zinc-700">{modal.instrucciones}</p>
              ) : (
                <p className="text-sm text-zinc-400">
                  El comprador no incluyó instrucciones adicionales para esta licitación.
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
