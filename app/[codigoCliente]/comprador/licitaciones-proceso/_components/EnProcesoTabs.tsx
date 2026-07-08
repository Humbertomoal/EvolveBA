"use client";

import { useState } from "react";
import type { LicitacionRow, MejorOfertaItem } from "@/src/lib/licitaciones";
import EnProcesoTabla from "./EnProcesoTabla";
import ManualTabla from "./ManualTabla";

export default function EnProcesoTabs({
  proveedoresLics,
  manualLics,
  mejoresOfertas,
  basePath,
}: {
  proveedoresLics: LicitacionRow[];
  manualLics: LicitacionRow[];
  mejoresOfertas: Record<string, MejorOfertaItem[]>;
  basePath: string;
}) {
  const [tab, setTab] = useState<"proveedores" | "manual">("proveedores");

  return (
    <div className="space-y-5">
      {/* Tab buttons */}
      <div className="flex gap-1 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab("proveedores")}
          className={`px-4 py-2 text-sm font-medium transition-all duration-150 border-b-2 -mb-px ${
            tab === "proveedores"
              ? "border-[var(--color-primario)] text-[var(--color-primario)]"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Licitación a Proveedores
          {proveedoresLics.length > 0 && (
            <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
              {proveedoresLics.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`px-4 py-2 text-sm font-medium transition-all duration-150 border-b-2 -mb-px ${
            tab === "manual"
              ? "border-[var(--color-primario)] text-[var(--color-primario)]"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Cotización Manual
          {manualLics.length > 0 && (
            <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
              {manualLics.length}
            </span>
          )}
        </button>
      </div>

      {tab === "proveedores" ? (
        <EnProcesoTabla
          licitaciones={proveedoresLics}
          basePath={basePath}
          mejoresOfertas={mejoresOfertas}
        />
      ) : (
        <ManualTabla licitaciones={manualLics} basePath={basePath} />
      )}
    </div>
  );
}
