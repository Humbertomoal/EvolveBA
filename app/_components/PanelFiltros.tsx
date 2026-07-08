"use client";

import { IconFilter } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeccionFiltroCheckboxes = {
  tipo?: "checkboxes";
  titulo: string;
  opciones: { label: string; value: string }[];
  seleccionados: string[];
  onToggle: (value: string) => void;
};

// Single-select dropdown. Optionally shows date pickers when valor === "personalizado".
export type SeccionFiltroSelect = {
  tipo: "select";
  titulo: string;
  opciones: { label: string; value: string }[]; // first option is the default
  valor: string;
  onCambio: (v: string) => void;
  fechaDesde?: string;
  fechaHasta?: string;
  onFechaDesde?: (v: string) => void;
  onFechaHasta?: (v: string) => void;
};

export type SeccionFiltroConfig = SeccionFiltroCheckboxes | SeccionFiltroSelect;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PanelFiltros({
  secciones,
  onLimpiar,
  onAplicar,
}: {
  secciones: SeccionFiltroConfig[];
  onLimpiar: () => void;
  onAplicar?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  // A select section is active when its value differs from the first (default) option.
  const contador = secciones.reduce((sum: any, s: any) => {
    if (s.tipo === "select") {
      return sum + (s.valor !== (s.opciones[0]?.value ?? "") ? 1 : 0);
    }
    return sum + s.seleccionados.length;
  }, 0);

  useEffect(() => {
    if (!abierto) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        botonRef.current &&
        !botonRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [abierto]);

  function handleLimpiar() {
    onLimpiar();
    setAbierto(false);
  }

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          contador > 0
            ? "border-[var(--color-primario)] bg-[var(--color-primario)]/5 text-[var(--color-primario)]"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <IconFilter className="h-4 w-4" />
        {contador > 0 ? `Filtros (${contador})` : "Filtros"}
      </button>

      {abierto && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 z-20 mt-1 w-[300px] rounded-[10px] border border-[#ede8e8] bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]"
        >
          {secciones.map((seccion) =>
            seccion.tipo === "select" ? (
              <div key={seccion.titulo} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {seccion.titulo}
                </p>
                <select
                  value={seccion.valor}
                  onChange={(e) => seccion.onCambio(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {seccion.opciones.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Date pickers shown only when "personalizado" is selected */}
                {seccion.valor === "personalizado" && seccion.fechaDesde !== undefined && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-xs text-zinc-400">Desde</span>
                      <input
                        type="date"
                        value={seccion.fechaDesde}
                        onChange={(e) => seccion.onFechaDesde?.(e.target.value)}
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-xs text-zinc-400">Hasta</span>
                      <input
                        type="date"
                        value={seccion.fechaHasta ?? ""}
                        onChange={(e) => seccion.onFechaHasta?.(e.target.value)}
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div key={seccion.titulo} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {seccion.titulo}
                </p>
                <div className="flex flex-col gap-1">
                  {seccion.opciones.map((opcion) => (
                    <label
                      key={opcion.value}
                      className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={seccion.seleccionados.includes(opcion.value)}
                        onChange={() => seccion.onToggle(opcion.value)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      {opcion.label}
                    </label>
                  ))}
                </div>
              </div>
            )
          )}

          <div className="flex gap-2 border-t border-zinc-100 pt-3">
            <button
              type="button"
              onClick={handleLimpiar}
              className="flex-1 rounded-md border border-zinc-300 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              onClick={() => { onAplicar?.(); setAbierto(false); }}
              className="flex-1 rounded-md bg-[var(--color-primario)] py-1.5 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
