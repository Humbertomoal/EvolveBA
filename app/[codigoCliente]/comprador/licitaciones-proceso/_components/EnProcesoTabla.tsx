"use client";

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconEye,
  IconMessage,
  IconPencil,
  IconPlayerSkipForward,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LicitacionRow, MejorOfertaItem } from "@/src/lib/licitaciones";
import {
  agregarRondaExtraAction,
  cancelarLicitacionAction,
  cerrarLicitacionAction,
  forzarAvanceRondaAction,
} from "@/src/lib/rondasActions";
import CountdownTimer from "@/src/components/CountdownTimer";
import PanelFiltros from "@/app/_components/PanelFiltros";

// ── Types ─────────────────────────────────────────────────────────────────────

type FiltrosEnProceso = {
  diasEnProceso: string[];
  fechaInicio: string;
  fechaInicioDesde: string;
  fechaInicioHasta: string;
  fechaFin: string;
  fechaFinDesde: string;
  fechaFinHasta: string;
};

const FILTROS_DEFAULT: FiltrosEnProceso = {
  diasEnProceso: [],
  fechaInicio: "",
  fechaInicioDesde: "",
  fechaInicioHasta: "",
  fechaFin: "",
  fechaFinDesde: "",
  fechaFinHasta: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Returns ms of the estimated end: fechaEjecucion + duracion * maxRondas
function calcFinEstimadoMs(l: LicitacionRow): number | null {
  if (!l.fechaEjecucion) return null;
  return (
    new Date(l.fechaEjecucion).getTime() +
    l.duracionRondaMinutos * l.maxRondas * 60 * 1000
  );
}

function applyFiltros(
  licitaciones: LicitacionRow[],
  busqueda: string,
  filtros: FiltrosEnProceso
): LicitacionRow[] {
  const now = Date.now();

  return licitaciones.filter((l) => {
    // ── Búsqueda ──
    const q = busqueda.toLowerCase();
    if (
      q &&
      !l.numero.toLowerCase().includes(q) &&
      !(l.jerarquia ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }

    // ── Días en proceso ──
    if (filtros.diasEnProceso.length > 0) {
      const referenciaMs = l.fechaInicioLicitacion
        ? new Date(l.fechaInicioLicitacion).getTime()
        : l.fechaEjecucion
          ? new Date(l.fechaEjecucion).getTime()
          : null;
      if (referenciaMs !== null) {
        const dias = (now - referenciaMs) / (24 * 60 * 60 * 1000);
        const match = filtros.diasEnProceso.some((d) => {
          if (d === "menos_1") return dias < 1;
          if (d === "1_3") return dias >= 1 && dias < 3;
          if (d === "3_7") return dias >= 3 && dias < 7;
          if (d === "mas_7") return dias >= 7;
          return false;
        });
        if (!match) return false;
      }
    }

    // ── Fecha de inicio ──
    if (filtros.fechaInicio && filtros.fechaInicio !== "") {
      const inicioMs = l.fechaInicioLicitacion
        ? new Date(l.fechaInicioLicitacion).getTime()
        : null;
      if (inicioMs !== null) {
        if (filtros.fechaInicio === "hoy") {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (inicioMs < startOfDay.getTime()) return false;
        } else if (filtros.fechaInicio === "semana") {
          if (inicioMs < now - 7 * 24 * 60 * 60 * 1000) return false;
        } else if (filtros.fechaInicio === "personalizado") {
          if (filtros.fechaInicioDesde) {
            if (inicioMs < new Date(filtros.fechaInicioDesde).getTime())
              return false;
          }
          if (filtros.fechaInicioHasta) {
            const end = new Date(filtros.fechaInicioHasta);
            end.setHours(23, 59, 59, 999);
            if (inicioMs > end.getTime()) return false;
          }
        }
      }
    }

    // ── Fecha de fin estimada ──
    if (filtros.fechaFin && filtros.fechaFin !== "") {
      const finMs = calcFinEstimadoMs(l);
      if (finMs !== null) {
        if (filtros.fechaFin === "24h") {
          if (finMs > now + 24 * 60 * 60 * 1000) return false;
        } else if (filtros.fechaFin === "3d") {
          if (finMs > now + 3 * 24 * 60 * 60 * 1000) return false;
        } else if (filtros.fechaFin === "semana") {
          if (finMs > now + 7 * 24 * 60 * 60 * 1000) return false;
        } else if (filtros.fechaFin === "personalizado") {
          if (filtros.fechaFinDesde) {
            if (finMs < new Date(filtros.fechaFinDesde).getTime()) return false;
          }
          if (filtros.fechaFinHasta) {
            const end = new Date(filtros.fechaFinHasta);
            end.setHours(23, 59, 59, 999);
            if (finMs > end.getTime()) return false;
          }
        }
      }
    }

    return true;
  });
}

// ── Per-row component ─────────────────────────────────────────────────────────

function EnProcesoFila({
  l,
  basePath,
  ejecutando,
  onForzarAvance,
  onAbrirDecision,
}: {
  l: LicitacionRow;
  basePath: string;
  ejecutando: boolean;
  onForzarAvance: (l: LicitacionRow) => void;
  onAbrirDecision: (l: LicitacionRow) => void;
}) {
  const targetFinMs =
    l.inicioRondaActual && !l.esperandoDecision
      ? new Date(l.inicioRondaActual).getTime() +
        l.duracionRondaMinutos * (l.maxRondas - l.rondaActual + 1) * 60 * 1000
      : null;

  const fechaFinEstimadaMs = calcFinEstimadoMs(l);

  return (
    <tr className="hover:bg-zinc-50/50 transition-colors duration-150">
      <td className="px-3 py-3" />
      <td className="px-3 py-3 font-medium text-zinc-800">{l.numero}</td>
      <td className="px-3 py-3 text-zinc-600">
        {l.fechaEjecucion ? formatFechaHora(l.fechaEjecucion) : "—"}
      </td>
      <td className="px-3 py-3 text-zinc-600">
        {fechaFinEstimadaMs
          ? formatFechaHora(new Date(fechaFinEstimadaMs).toISOString())
          : "—"}
      </td>
      <td className="px-3 py-3 text-center">
        {l.esperandoDecision ? (
          <span className="text-xs font-medium text-violet-600">
            Esperando decisión
          </span>
        ) : targetFinMs === null ? (
          <span className="text-zinc-300">——</span>
        ) : (
          <CountdownTimer fechaFin={new Date(targetFinMs)} precision="minutes" />
        )}
      </td>
      <td className="px-3 py-3 text-zinc-600">{l.jerarquia ?? "—"}</td>
      <td className="px-3 py-3 text-zinc-600">Comprador 1</td>
      <td className="px-3 py-3 text-zinc-600">{formatPeso(l.costoObjetivo)}</td>

      <td className="px-3 py-3">
        {l.esperandoDecision ? (
          <button
            type="button"
            onClick={() => onAbrirDecision(l)}
            className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-200"
          >
            <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
            Esperando decisión
          </button>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              En Proceso
            </span>
            <span className="pl-1 text-xs text-zinc-400">
              Ronda {l.rondaActual}/{l.maxRondas}
            </span>
          </div>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <Link
            href={`${basePath}/comprador/licitaciones-proceso/${l.id}`}
            className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
            title="Ver detalle"
          >
            <IconEye className="h-4 w-4" />
          </Link>
          <Link
            href={`${basePath}/comprador/licitaciones/${l.id}/editar`}
            className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
            title="Editar"
          >
            <IconPencil className="h-4 w-4" />
          </Link>
          {!l.esperandoDecision && (
            <button
              type="button"
              onClick={() => onForzarAvance(l)}
              disabled={ejecutando}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
              title="Forzar avance de ronda"
            >
              <IconPlayerSkipForward className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled
            className="rounded-md p-1.5 text-zinc-300"
            title="Ver chat / dudas (próximamente)"
          >
            <IconMessage className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EnProcesoTabla({
  licitaciones,
  basePath,
  mejoresOfertas,
}: {
  licitaciones: LicitacionRow[];
  basePath: string;
  mejoresOfertas: Record<string, MejorOfertaItem[]>;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosEnProceso>(FILTROS_DEFAULT);
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const [modalDecision, setModalDecision] = useState<LicitacionRow | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [toggleCancelar, setToggleCancelar] = useState(false);

  function setFiltroField<K extends keyof FiltrosEnProceso>(
    key: K,
    value: FiltrosEnProceso[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDias(v: string) {
    setFiltros((prev) => ({
      ...prev,
      diasEnProceso: prev.diasEnProceso.includes(v)
        ? prev.diasEnProceso.filter((d) => d !== v)
        : [...prev.diasEnProceso, v],
    }));
  }

  const filtradas = applyFiltros(licitaciones, busqueda, filtros);

  function cerrarModalDecision() {
    setModalDecision(null);
    setConfirmandoCancelar(false);
    setToggleCancelar(false);
  }

  async function handleForzarAvance(l: LicitacionRow) {
    const esUltimaRonda = l.rondaActual >= l.maxRondas;
    const msg = esUltimaRonda
      ? `¿Forzar el cierre de la Ronda ${l.rondaActual} (última)? Esto activará el proceso de decisión final.`
      : `¿Forzar avance a la Ronda ${l.rondaActual + 1}?`;
    if (!window.confirm(msg)) return;
    setEjecutando(l.id);
    await forzarAvanceRondaAction(l.id, basePath);
    setEjecutando(null);
  }

  async function handleAgregarRonda(id: string) {
    setEjecutando(id);
    await agregarRondaExtraAction(id, basePath);
    setEjecutando(null);
    cerrarModalDecision();
  }

  async function handleCerrar(id: string) {
    setEjecutando(id);
    await cerrarLicitacionAction(id, basePath);
    setEjecutando(null);
    cerrarModalDecision();
  }

  async function handleCancelarLicitacion(id: string) {
    setEjecutando(id);
    await cancelarLicitacionAction(id, basePath);
    setEjecutando(null);
    cerrarModalDecision();
  }

  const hayOfertas = modalDecision
    ? (mejoresOfertas[modalDecision.id] ?? []).length > 0
    : false;

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
              titulo: "Días en proceso",
              opciones: [
                { label: "Menos de 1 día", value: "menos_1" },
                { label: "1 a 3 días", value: "1_3" },
                { label: "3 a 7 días", value: "3_7" },
                { label: "Más de 7 días", value: "mas_7" },
              ],
              seleccionados: filtros.diasEnProceso,
              onToggle: toggleDias,
            },
            {
              tipo: "select",
              titulo: "Fecha de inicio",
              valor: filtros.fechaInicio,
              onCambio: (v) => setFiltroField("fechaInicio", v),
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Hoy", value: "hoy" },
                { label: "Última semana", value: "semana" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaInicioDesde,
              fechaHasta: filtros.fechaInicioHasta,
              onFechaDesde: (v) => setFiltroField("fechaInicioDesde", v),
              onFechaHasta: (v) => setFiltroField("fechaInicioHasta", v),
            },
            {
              tipo: "select",
              titulo: "Fecha de fin estimada",
              valor: filtros.fechaFin,
              onCambio: (v) => setFiltroField("fechaFin", v),
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Próximas 24 horas (urgente)", value: "24h" },
                { label: "Próximos 3 días", value: "3d" },
                { label: "Próxima semana", value: "semana" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaFinDesde,
              fechaHasta: filtros.fechaFinHasta,
              onFechaDesde: (v) => setFiltroField("fechaFinDesde", v),
              onFechaHasta: (v) => setFiltroField("fechaFinHasta", v),
            },
          ]}
        />
      </div>

      {/* Table */}
      {filtradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          Sin licitaciones en proceso.
        </p>
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="w-8 px-3 py-3" />
                  <th className="min-w-[130px] px-3 py-3">Número</th>
                  <th className="min-w-[170px] px-3 py-3">Fecha y hora de inicio</th>
                  <th className="min-w-[170px] px-3 py-3">Fecha y hora de fin estimada</th>
                  <th className="min-w-[140px] px-3 py-3 text-center">
                    Tiempo restante
                  </th>
                  <th className="min-w-[120px] px-3 py-3">Criticidad</th>
                  <th className="min-w-[110px] px-3 py-3">Comprador</th>
                  <th className="min-w-[140px] px-3 py-3">Costo Objetivo</th>
                  <th className="min-w-[150px] px-3 py-3">Estatus</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtradas.map((l: any) => (
                  <EnProcesoFila
                    key={l.id}
                    l={l}
                    basePath={basePath}
                    ejecutando={ejecutando === l.id}
                    onForzarAvance={handleForzarAvance}
                    onAbrirDecision={setModalDecision}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Decisión Final ─────────────────────────────────────────── */}
      {modalDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  {confirmandoCancelar
                    ? "Confirmar cancelación"
                    : `Decisión Final — Licitación ${modalDecision.numero}`}
                </h2>
                {!confirmandoCancelar && hayOfertas && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Todas las rondas han concluido. Revisa las mejores ofertas por
                    producto.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={cerrarModalDecision}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {confirmandoCancelar ? (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-700">
                    ¿Cancelar esta licitación? Ningún proveedor cotizó y esta
                    acción no se puede deshacer.
                  </p>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={toggleCancelar}
                      onChange={(e) => setToggleCancelar(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 accent-red-600"
                    />
                    <span className="text-sm text-zinc-700">
                      Entiendo que esta acción es permanente
                    </span>
                  </label>
                </div>
              ) : hayOfertas ? (
                <ul className="space-y-2">
                  {(mejoresOfertas[modalDecision.id] ?? []).map((o, i) => (
                    <li key={i} className="rounded-lg bg-zinc-50 px-4 py-2.5">
                      <p className="text-sm font-medium text-zinc-800">
                        {o.productoNombre}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Mejor oferta en{" "}
                        <span className="font-medium text-zinc-700">
                          Ronda {o.ronda}
                        </span>
                        {" — "}
                        <span className="font-semibold text-emerald-700">
                          ${o.precioUnitario.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {" por "}{o.proveedorNombre}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-start gap-3">
                  <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <p className="text-sm text-zinc-700">
                    Ningún proveedor envió cotizaciones en esta licitación.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              {confirmandoCancelar ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoCancelar(false);
                      setToggleCancelar(false);
                    }}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    No, regresar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelarLicitacion(modalDecision.id)}
                    disabled={!toggleCancelar || ejecutando === modalDecision.id}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    Cancelar licitación
                  </button>
                </>
              ) : hayOfertas ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAgregarRonda(modalDecision.id)}
                    disabled={ejecutando === modalDecision.id}
                    className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                  >
                    Agregar ronda extra
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCerrar(modalDecision.id)}
                    disabled={ejecutando === modalDecision.id}
                    className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-secundario)] disabled:opacity-50"
                  >
                    Cerrar licitación
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleAgregarRonda(modalDecision.id)}
                    disabled={ejecutando === modalDecision.id}
                    className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                  >
                    Agregar ronda extra
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = modalDecision.id;
                      cerrarModalDecision();
                      router.push(
                        `${basePath}/comprador/licitaciones/${id}/editar`
                      );
                    }}
                    disabled={ejecutando === modalDecision.id}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Editar fechas y reintentar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoCancelar(true)}
                    disabled={ejecutando === modalDecision.id}
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancelar licitación
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
