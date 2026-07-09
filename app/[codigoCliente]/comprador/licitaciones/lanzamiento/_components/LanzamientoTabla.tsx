"use client";

import {
  IconClock,
  IconPencil,
  IconFlag,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { LicitacionRow } from "@/src/lib/licitaciones";
import { eliminarLicitacionAction } from "@/src/lib/licitacionesActions";
import PanelFiltros from "@/app/_components/PanelFiltros";
import EmptyState from "@/src/components/EmptyState";

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fechaISO: string): number {
  return Math.floor(
    (Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatFecha(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

const BADGE_CLASS: Record<string, string> = {
  Borrador: "bg-zinc-100 text-zinc-600",
  Programada: "bg-blue-100 text-blue-700",
  "En Proceso": "bg-emerald-100 text-emerald-700",
  Cerrada: "bg-zinc-200 text-zinc-500",
};

// ── Per-row component with live countdown ─────────────────────────────────────

function LicitacionFila({
  l,
  basePath,
  onEliminar,
  eliminando,
}: {
  l: LicitacionRow;
  basePath: string;
  onEliminar: (id: string) => void;
  eliminando: boolean;
}) {
  const targetMs = l.fechaEjecucion ? new Date(l.fechaEjecucion).getTime() : null;
  const [ms, setMs] = useState(() =>
    targetMs !== null ? Math.max(0, targetMs - Date.now()) : 0
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (targetMs === null || l.estado === "En Proceso") return;

    function tick() {
      const remaining = Math.max(0, targetMs! - Date.now());
      setMs(remaining);
      timerRef.current = setTimeout(tick, 1_000);
    }
    tick();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [targetMs, l.estado]);

  // urgency — based on exact hours, only for Programada rows
  let urgencia: "rojo" | "ambar" | null = null;
  if (l.estado === "Programada" && targetMs !== null && ms > 0) {
    if (ms < 3 * 3_600_000) urgencia = "rojo";
    else if (ms < 24 * 3_600_000) urgencia = "ambar";
  }

  // countdown content
  let countdownNode: React.ReactNode;
  if (l.estado === "En Proceso") {
    countdownNode = (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        En curso
      </span>
    );
  } else if (targetMs === null) {
    countdownNode = <span className="text-zinc-300">——</span>;
  } else if (ms <= 0) {
    countdownNode = (
      <span className="font-semibold text-emerald-600">Iniciando...</span>
    );
  } else {
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let text: string;
    if (days > 0) text = `${days}d ${hours}h ${mins}m ${secs}s`;
    else if (hours > 0) text = `${hours}h ${mins}m ${secs}s`;
    else text = `${mins}m ${secs}s`;

    countdownNode = (
      <span
        className={
          urgencia === "rojo"
            ? "font-semibold text-red-600"
            : urgencia === "ambar"
              ? "font-semibold text-amber-600"
              : "text-zinc-600"
        }
      >
        {text}
      </span>
    );
  }

  return (
    <tr className="hover:bg-zinc-50/50 transition-colors duration-150">
      {/* Urgency indicator */}
      <td className="px-3 py-3">
        {urgencia === "rojo" && <IconFlag className="h-4 w-4 text-red-500" />}
        {urgencia === "ambar" && <IconClock className="h-4 w-4 text-amber-500" />}
      </td>
      <td className="px-3 py-3 font-medium text-zinc-800">{l.numero}</td>
      <td className="px-3 py-3 text-zinc-600">{formatFecha(l.fechaCreacion)}</td>
      <td className="px-3 py-3 text-zinc-600">
        {l.fechaEjecucion ? formatFechaHora(l.fechaEjecucion) : "—"}
      </td>
      <td className="px-3 py-3 text-zinc-600">{l.jerarquia ?? "—"}</td>
      <td className="px-3 py-3 text-zinc-600">Comprador 1</td>
      <td className="px-3 py-3 text-zinc-600">{formatPeso(l.costoObjetivo)}</td>
      <td className="px-3 py-3 text-center text-zinc-600">
        {l.estado === "Borrador" ? (
          <span className="text-zinc-300">——</span>
        ) : (
          diasDesde(l.fechaCreacion)
        )}
      </td>
      <td className="px-3 py-3 text-center">{countdownNode}</td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            BADGE_CLASS[l.estado] ?? "bg-zinc-100 text-zinc-600"
          }`}
        >
          {l.estado}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Link
            href={`${basePath}/comprador/licitaciones/${l.id}/editar`}
            className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
            title="Editar"
          >
            <IconPencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => onEliminar(l.id)}
            disabled={eliminando}
            className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
            title="Eliminar"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LanzamientoTabla({
  licitaciones,
  basePath,
}: {
  licitaciones: LicitacionRow[];
  basePath: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtrosEstado, setFiltrosEstado] = useState<string[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const filtradas = licitaciones.filter((l) => {
    const q = busqueda.toLowerCase();
    const matchQ =
      !q ||
      l.numero.toLowerCase().includes(q) ||
      (l.jerarquia ?? "").toLowerCase().includes(q);
    const matchEstado =
      filtrosEstado.length === 0 || filtrosEstado.includes(l.estado);
    return matchQ && matchEstado;
  });

  async function handleEliminar(id: string) {
    if (
      !window.confirm(
        "¿Eliminar esta licitación? Esta acción no se puede deshacer."
      )
    )
      return;
    setEliminando(id);
    try {
      await eliminarLicitacionAction(id, basePath);
      toast.success("Licitación eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar la licitación. Intenta de nuevo.");
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por número o criticidad…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <PanelFiltros
          secciones={[
            {
              titulo: "Estatus",
              opciones: [
                { label: "Borrador", value: "Borrador" },
                { label: "Programada", value: "Programada" },
              ],
              seleccionados: filtrosEstado,
              onToggle: (v) =>
                setFiltrosEstado((prev) =>
                  prev.includes(v)
                    ? prev.filter((x) => x !== v)
                    : [...prev, v]
                ),
            },
          ]}
          onLimpiar={() => setFiltrosEstado([])}
        />
      </div>

      {/* Table */}
      {filtradas.length === 0 ? (
        licitaciones.length === 0 ? (
          <EmptyState
            icon="IconFileInvoice"
            title="Aún no hay licitaciones registradas"
            description="Lanza tu primera licitación para empezar a recibir cotizaciones de proveedores."
          />
        ) : (
          <EmptyState
            icon="IconSearchOff"
            title="Sin resultados"
            description="No se encontraron licitaciones con los filtros aplicados."
          />
        )
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="w-8 px-3 py-3" />
                <th className="min-w-[130px] px-3 py-3">Número</th>
                <th className="min-w-[120px] px-3 py-3">Fecha Creación</th>
                <th className="min-w-[170px] px-3 py-3">Fecha y hora de inicio</th>
                <th className="min-w-[120px] px-3 py-3">Criticidad</th>
                <th className="min-w-[110px] px-3 py-3">Comprador</th>
                <th className="min-w-[140px] px-3 py-3">Costo Objetivo</th>
                <th className="min-w-[120px] px-3 py-3 text-center">
                  Días en Proceso
                </th>
                <th className="min-w-[140px] px-3 py-3 text-center">
                  Tiempo para Inicio
                </th>
                <th className="min-w-[110px] px-3 py-3">Estatus</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtradas.map((l: any) => (
                <LicitacionFila
                  key={l.id}
                  l={l}
                  basePath={basePath}
                  onEliminar={handleEliminar}
                  eliminando={eliminando === l.id}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
