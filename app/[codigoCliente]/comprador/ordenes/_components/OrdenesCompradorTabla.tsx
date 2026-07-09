"use client";

import {
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  FILTROS_COMPRADOR_DEFAULT,
  type FiltrosOrdenesComprador,
  type OrdenCompradorRow,
} from "@/src/lib/ordenesTypes";
import {
  actualizarEstatusOrdenAction,
  buscarOrdenesCompradorAction,
} from "@/src/lib/ordenesActions";
import PanelFiltros from "@/app/_components/PanelFiltros";
import CountdownTimer from "@/src/components/CountdownTimer";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import EmptyState from "@/src/components/EmptyState";

const TODOS_ESTADOS = ["Pendiente", "En tránsito", "Entregada", "Recibida", "Cancelada"];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const ESTATUS_VARIANT: Record<string, BadgeVariant> = {
  Pendiente: "pendiente",
  "En tránsito": "en-transito",
  Entregada: "entregada",
  Recibida: "recibida",
  Cancelada: "cancelada",
};

function EstatusBadge({ estado }: { estado: string }) {
  return <Badge variant={ESTATUS_VARIANT[estado] ?? "neutral"}>{estado}</Badge>;
}

export default function OrdenesCompradorTabla({
  initialData,
  initialCursor,
  licitacionesUnicas,
  basePath,
}: {
  initialData: OrdenCompradorRow[];
  initialCursor: string | null;
  licitacionesUnicas: string[];
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cargandoMas, setCargandoMas] = useState(false);

  const [filas, setFilas] = useState<OrdenCompradorRow[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filtros, setFiltros] = useState<FiltrosOrdenesComprador>(FILTROS_COMPRADOR_DEFAULT);
  const [q, setQ] = useState("");

  function setFiltro<K extends keyof FiltrosOrdenesComprador>(
    key: K,
    value: FiltrosOrdenesComprador[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function toggleEstado(v: string) {
    setFiltros((prev) => ({
      ...prev,
      estados: prev.estados.includes(v)
        ? prev.estados.filter((e) => e !== v)
        : [...prev.estados, v],
    }));
  }

  function fetchData(
    f: FiltrosOrdenesComprador,
    c: string | null,
    append: boolean
  ) {
    startTransition(async () => {
      const result = await buscarOrdenesCompradorAction(f, c);
      if (append) {
        setFilas((prev) => [...prev, ...result.ordenes]);
      } else {
        setFilas(result.ordenes);
      }
      setCursor(result.nextCursor);
    });
  }

  function aplicarFiltros() {
    fetchData(filtros, null, false);
  }

  function limpiarFiltros() {
    setQ("");
    setFiltros(FILTROS_COMPRADOR_DEFAULT);
    fetchData(FILTROS_COMPRADOR_DEFAULT, null, false);
  }

  async function cargarMas() {
    if (!cursor || cargandoMas || isPending) return;
    setCargandoMas(true);
    const result = await buscarOrdenesCompradorAction(filtros, cursor);
    setFilas((prev) => [...prev, ...result.ordenes]);
    setCursor(result.nextCursor);
    setCargandoMas(false);
  }

  function handleCambioEstatus(ordenId: string, nuevoEstado: string) {
    startTransition(async () => {
      await actualizarEstatusOrdenAction(ordenId, nuevoEstado, basePath);
    });
  }

  const filasVisibles = q.trim()
    ? filas.filter((o: any) => {
        const qL = q.toLowerCase();
        return (
          o.numero.toLowerCase().includes(qL) ||
          o.licitacionNumero.toLowerCase().includes(qL)
        );
      })
    : filas;

  const labelPeriodo = filtros.periodo !== "" ? "del período seleccionado" : "activas";

  const CELL = "px-4 py-3";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por número de OC o licitación…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <PanelFiltros
          onLimpiar={limpiarFiltros}
          onAplicar={aplicarFiltros}
          secciones={[
            {
              titulo: "Estatus",
              opciones: [
                { label: "Pendiente", value: "Pendiente" },
                { label: "En tránsito", value: "En tránsito" },
                { label: "Entregada", value: "Entregada" },
                { label: "Recibida", value: "Recibida" },
                { label: "Cancelada", value: "Cancelada" },
              ],
              seleccionados: filtros.estados,
              onToggle: toggleEstado,
            },
            {
              tipo: "select" as const,
              titulo: "Licitación",
              opciones: [
                { label: "Todas", value: "" },
                ...licitacionesUnicas.map((n) => ({ label: n, value: n })),
              ],
              valor: filtros.licitacionNumero,
              onCambio: (v) => setFiltro("licitacionNumero", v),
            },
            {
              tipo: "select" as const,
              titulo: "Fecha de OC",
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Última semana", value: "semana" },
                { label: "Último mes", value: "mes" },
                { label: "Últimos 3 meses", value: "3meses" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              valor: filtros.periodo,
              onCambio: (v) => setFiltro("periodo", v),
              fechaDesde: filtros.fechaDesde,
              fechaHasta: filtros.fechaHasta,
              onFechaDesde: (v) => setFiltro("fechaDesde", v),
              onFechaHasta: (v) => setFiltro("fechaHasta", v),
            },
          ]}
        />
      </div>

      {/* Tabla */}
      {filasVisibles.length === 0 ? (
        <EmptyState
          icon="IconClipboardOff"
          title={filas.length === 0 ? "Sin órdenes de compra" : "Sin resultados"}
          description={
            filas.length === 0
              ? "No hay órdenes de compra para los filtros seleccionados."
              : "Sin resultados para tu búsqueda."
          }
        />
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="min-w-[110px] px-4 py-3">Número OC</th>
                  <th className="min-w-[120px] px-4 py-3">Licitación</th>
                  <th className="min-w-[110px] px-4 py-3">Criticidad</th>
                  <th className="min-w-[160px] px-4 py-3">Proveedor</th>
                  <th className="min-w-[80px] px-4 py-3 text-center">Materiales</th>
                  <th className="min-w-[110px] px-4 py-3">Fecha OC</th>
                  <th className="min-w-[110px] px-4 py-3">ETD</th>
                  <th className="min-w-[130px] px-4 py-3">Tiempo restante</th>
                  <th className="min-w-[110px] px-4 py-3">Estatus</th>
                  <th className="min-w-[170px] px-4 py-3">Actualizar estatus</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filasVisibles.map((o: any) => (
                  <tr key={o.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className={`${CELL} font-semibold text-zinc-800`}>{o.numero}</td>
                    <td className={`${CELL} text-zinc-600`}>{o.licitacionNumero}</td>
                    <td className={`${CELL} text-zinc-600`}>{o.jerarquia ?? "—"}</td>
                    <td className={`${CELL} text-zinc-700`}>{o.proveedorNombre}</td>
                    <td className={`${CELL} text-center`}>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        {o.totalLineas}
                      </span>
                    </td>
                    <td className={`${CELL} text-zinc-600`}>{formatFecha(o.fechaCreacion)}</td>
                    <td className={`${CELL} text-zinc-600`}>{formatFecha(o.fechaEstimadaEntrega)}</td>
                    <td className={CELL}>
                      {o.fechaEstimadaEntrega ? (
                        <CountdownTimer
                          fechaFin={new Date(o.fechaEstimadaEntrega)}
                          precision="minutes"
                        />
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className={CELL}>
                      <EstatusBadge estado={o.estado} />
                    </td>
                    <td className={CELL}>
                      <select
                        defaultValue={o.estado}
                        disabled={isPending}
                        onChange={(e) => handleCambioEstatus(o.id, e.target.value)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                      >
                        {TODOS_ESTADOS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Ver detalle"
                          onClick={() => router.push(`${basePath}/comprador/ordenes/${o.id}`)}
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <IconEye className="h-4 w-4" />
                        </button>
                        <a
                          href={`${basePath}/comprador/ordenes/${o.id}/imprimir`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descargar PDF"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <IconDownload className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer indicator */}
      {(filas.length > 0 || cursor) && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            Mostrando {filas.length} {filas.length === 1 ? "orden" : "órdenes"}{" "}
            {labelPeriodo}
            {isPending && " · Cargando…"}
          </span>
          {cursor && (
            <button
              type="button"
              onClick={cargarMas}
              disabled={cargandoMas || isPending}
              className="font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
            >
              {cargandoMas ? "Cargando…" : "Cargar 25 más →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
