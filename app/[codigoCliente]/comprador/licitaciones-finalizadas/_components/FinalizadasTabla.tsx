"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import PanelFiltros from "@/app/_components/PanelFiltros";
import Badge from "@/src/components/Badge";
import { buscarFinalizadasAction } from "@/src/lib/finalizadasActions";
import {
  FILTROS_DEFAULT,
  type FiltrosFinalizadas,
  type LicitacionFinalizada,
} from "@/src/lib/finalizadasTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeso(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FinalizadasTabla({
  initialData,
  initialCursor,
  jerarquias,
  basePath,
}: {
  initialData: LicitacionFinalizada[];
  initialCursor: string | null;
  jerarquias: string[];
  basePath: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState<LicitacionFinalizada[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filtros, setFiltros] = useState<FiltrosFinalizadas>(FILTROS_DEFAULT);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleEstado(v: string) {
    setFiltros((prev) => ({
      ...prev,
      estados: prev.estados.includes(v)
        ? prev.estados.filter((e) => e !== v)
        : [...prev.estados, v],
    }));
  }

  function setFiltro<K extends keyof FiltrosFinalizadas>(
    key: K,
    value: FiltrosFinalizadas[K]
  ) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function fetchData(f: FiltrosFinalizadas, c: string | null, append: boolean) {
    startTransition(async () => {
      const result = await buscarFinalizadasAction(f, c);
      if (append) {
        setFilas((prev) => [...prev, ...result.licitaciones]);
      } else {
        setFilas(result.licitaciones);
      }
      setCursor(result.nextCursor);
    });
  }

  function aplicarFiltros() {
    fetchData(filtros, null, false);
  }

  function limpiarFiltros() {
    setBusqueda("");
    setFiltros(FILTROS_DEFAULT);
    fetchData(FILTROS_DEFAULT, null, false);
  }

  async function cargarMas() {
    if (!cursor || cargandoMas || isPending) return;
    setCargandoMas(true);
    const result = await buscarFinalizadasAction(filtros, cursor);
    setFilas((prev) => [...prev, ...result.licitaciones]);
    setCursor(result.nextCursor);
    setCargandoMas(false);
  }

  const filasVisibles = filas.filter((l) => {
    const q = busqueda.toLowerCase();
    return (
      !q ||
      l.numero.toLowerCase().includes(q) ||
      (l.jerarquia ?? "").toLowerCase().includes(q)
    );
  });

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
          onLimpiar={limpiarFiltros}
          onAplicar={aplicarFiltros}
          secciones={[
            {
              titulo: "Estado",
              opciones: [
                { label: "Finalizada", value: "Finalizada" },
                { label: "Cancelada", value: "Cancelada" },
              ],
              seleccionados: filtros.estados,
              onToggle: toggleEstado,
            },
            {
              tipo: "select",
              titulo: "Fecha de creación",
              valor: filtros.fechaCreacionVentana,
              onCambio: (v) => setFiltro("fechaCreacionVentana", v),
              opciones: [
                { label: "Último mes", value: "mes" },
                { label: "Última semana", value: "semana" },
                { label: "Últimos 3 meses", value: "tres_meses" },
                { label: "Últimos 6 meses", value: "seis_meses" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaCreacionDesde,
              fechaHasta: filtros.fechaCreacionHasta,
              onFechaDesde: (v) => setFiltro("fechaCreacionDesde", v),
              onFechaHasta: (v) => setFiltro("fechaCreacionHasta", v),
            },
            {
              tipo: "select",
              titulo: "Fecha de inicio",
              valor: filtros.fechaInicioVentana,
              onCambio: (v) => setFiltro("fechaInicioVentana", v),
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Última semana", value: "semana" },
                { label: "Último mes", value: "mes" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaInicioDesde,
              fechaHasta: filtros.fechaInicioHasta,
              onFechaDesde: (v) => setFiltro("fechaInicioDesde", v),
              onFechaHasta: (v) => setFiltro("fechaInicioHasta", v),
            },
            {
              tipo: "select",
              titulo: "Fecha de finalización",
              valor: filtros.fechaFinVentana,
              onCambio: (v) => setFiltro("fechaFinVentana", v),
              opciones: [
                { label: "Sin filtrar", value: "" },
                { label: "Última semana", value: "semana" },
                { label: "Último mes", value: "mes" },
                { label: "Rango personalizado", value: "personalizado" },
              ],
              fechaDesde: filtros.fechaFinDesde,
              fechaHasta: filtros.fechaFinHasta,
              onFechaDesde: (v) => setFiltro("fechaFinDesde", v),
              onFechaHasta: (v) => setFiltro("fechaFinHasta", v),
            },
            {
              tipo: "select",
              titulo: "Criticidad",
              valor: filtros.jerarquia,
              onCambio: (v) => setFiltro("jerarquia", v),
              opciones: [
                { label: "Todas", value: "" },
                ...jerarquias.map((j) => ({ label: j, value: j })),
              ],
            },
          ]}
        />
        {isPending && (
          <span className="text-xs text-zinc-400">Cargando…</span>
        )}
      </div>

      {/* Table */}
      {filasVisibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          {filas.length === 0
            ? "Sin licitaciones en el período seleccionado."
            : "Sin resultados para tu búsqueda."}
        </p>
      ) : (
        <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="min-w-[130px] px-3 py-3">Número</th>
                <th className="min-w-[110px] px-3 py-3">Modo</th>
                <th className="min-w-[130px] px-3 py-3">Criticidad</th>
                <th className="min-w-[130px] px-3 py-3">Fecha de inicio</th>
                <th className="min-w-[130px] px-3 py-3">Fecha de cierre</th>
                <th className="min-w-[140px] px-3 py-3">Fecha de finalización</th>
                <th className="min-w-[100px] px-3 py-3 text-right">Materiales</th>
                <th className="min-w-[110px] px-3 py-3 text-right">Proveedores</th>
                <th className="min-w-[140px] px-3 py-3 text-right">Costo Final</th>
                <th className="min-w-[100px] px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filasVisibles.map((l: any) => (
                <tr
                  key={l.id}
                  className="hover:bg-zinc-50/50 transition-colors duration-150"
                >
                  <td className="px-3 py-3 font-medium text-zinc-800">
                    <Link
                      href={`${basePath}/comprador/licitaciones-finalizadas/${l.id}`}
                      className="hover:text-[var(--color-primario)] hover:underline"
                    >
                      {l.numero}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={l.modoLicitacion === "Manual" ? "warning" : "info"}>
                      {l.modoLicitacion}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-zinc-600">
                    {l.jerarquia ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-zinc-600">
                    {formatFecha(l.fechaInicio)}
                  </td>
                  <td className="px-3 py-3 text-zinc-600">
                    {formatFecha(l.fechaCierre)}
                  </td>
                  <td className="px-3 py-3 text-zinc-600">
                    {formatFecha(l.fechaFin)}
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-600">
                    {l.numItems}
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-600">
                    {l.numProveedores}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-zinc-800">
                    {formatPeso(l.costoFinal)}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={l.estado === "Cancelada" ? "cancelada" : "finalizada"}>
                      {l.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Load more */}
      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={cargarMas}
            disabled={cargandoMas || isPending}
            className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargandoMas ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
