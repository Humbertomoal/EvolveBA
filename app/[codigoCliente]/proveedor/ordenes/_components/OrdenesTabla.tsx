"use client";

import {
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  FILTROS_ORDENES_DEFAULT,
  type FiltrosOrdenes,
  type OrdenCompraRow,
} from "@/src/lib/ordenesTypes";
import {
  actualizarEstatusOrdenAction,
  buscarOrdenesProveedorAction,
} from "@/src/lib/ordenesActions";
import PanelFiltros from "@/app/_components/PanelFiltros";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import EmptyState from "@/src/components/EmptyState";

const ESTADOS_PROVEEDOR = ["Pendiente", "En tránsito", "Entregada", "Cancelada"];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoneda(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

const ESTATUS_VARIANT: Record<string, BadgeVariant> = {
  Pendiente: "pendiente",
  "En tránsito": "en-transito",
  Entregada: "entregada",
  Cancelada: "cancelada",
};

function EstatusBadge({ estado }: { estado: string }) {
  return <Badge variant={ESTATUS_VARIANT[estado] ?? "neutral"}>{estado}</Badge>;
}

export default function OrdenesTabla({
  initialData,
  initialCursor,
  basePath,
}: {
  initialData: OrdenCompraRow[];
  initialCursor: string | null;
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cargandoMas, setCargandoMas] = useState(false);

  const [filas, setFilas] = useState<OrdenCompraRow[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filtros, setFiltros] = useState<FiltrosOrdenes>(FILTROS_ORDENES_DEFAULT);
  const [q, setQ] = useState("");

  function setFiltro<K extends keyof FiltrosOrdenes>(
    key: K,
    value: FiltrosOrdenes[K]
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

  function fetchData(f: FiltrosOrdenes, c: string | null, append: boolean) {
    startTransition(async () => {
      const result = await buscarOrdenesProveedorAction(f, c);
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
    setFiltros(FILTROS_ORDENES_DEFAULT);
    fetchData(FILTROS_ORDENES_DEFAULT, null, false);
  }

  async function cargarMas() {
    if (!cursor || cargandoMas || isPending) return;
    setCargandoMas(true);
    const result = await buscarOrdenesProveedorAction(filtros, cursor);
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
              ? "No tienes órdenes de compra para los filtros seleccionados."
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
                <th className="min-w-[110px] px-4 py-3">Fecha creación</th>
                <th className="min-w-[120px] px-4 py-3">Entrega estimada</th>
                <th className="min-w-[110px] px-4 py-3 text-right">Total</th>
                <th className="min-w-[110px] px-4 py-3">Estatus</th>
                <th className="min-w-[160px] px-4 py-3">Actualizar estatus</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filasVisibles.map((o: any) => (
                <tr key={o.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className={`${CELL} font-semibold text-zinc-800`}>{o.numero}</td>
                  <td className={`${CELL} text-zinc-600`}>{o.licitacionNumero}</td>
                  <td className={`${CELL} text-zinc-600`}>{o.jerarquia ?? "—"}</td>
                  <td className={`${CELL} text-zinc-600`}>{formatFecha(o.fechaCreacion)}</td>
                  <td className={`${CELL} text-zinc-600`}>{formatFecha(o.fechaEstimadaEntrega)}</td>
                  <td className={`${CELL} text-right font-medium text-zinc-800`}>
                    {formatMoneda(o.total)}
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
                      {ESTADOS_PROVEEDOR.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Ver detalle"
                        onClick={() => router.push(`${basePath}/proveedor/ordenes/${o.id}`)}
                        className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors duration-150"
                      >
                        <IconEye className="h-4 w-4" />
                      </button>
                      <a
                        href={`${basePath}/proveedor/ordenes/${o.id}/imprimir`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Descargar PDF"
                        className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors duration-150"
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
