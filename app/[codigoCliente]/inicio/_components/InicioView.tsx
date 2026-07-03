"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBuildingStore, IconTruck } from "@tabler/icons-react";
import Link from "next/link";

const COMPRADOR_COOKIE = "cyrgo_comprador_id";
const VER_TODO_ID = "__todos__";

export type CompradorOpcion = { id: string; label: string };

export default function InicioView({
  basePath,
  compradores,
}: {
  basePath: string;
  compradores: CompradorOpcion[];
}) {
  const router = useRouter();
  const [seleccionando, setSeleccionando] = useState(false);
  const [compradorId, setCompradorId] = useState(compradores[0]?.id ?? "default");

  function handleCompradorClick() {
    // Si solo hay la opción default o un comprador normal, entrar directo
    if (compradores.length === 1 && compradores[0].id === "default") {
      router.push(`${basePath}/comprador`);
      return;
    }
    setSeleccionando(true);
  }

  function handleConfirmar() {
    document.cookie = `${COMPRADOR_COOKIE}=${compradorId}; path=/; max-age=86400; SameSite=Lax`;
    router.push(`${basePath}/comprador`);
  }

  const esVerTodo = compradorId === VER_TODO_ID;

  const CARD_BASE =
    "flex w-64 flex-col items-center gap-3 rounded-xl border border-white/25 bg-white/[12%] px-6 py-8 text-white transition-colors hover:bg-white/20";

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* ── Tarjeta Comprador ──────────────────────────────────────────── */}
      {seleccionando ? (
        <div className="flex w-64 flex-col gap-3 rounded-xl border border-white/25 bg-white/[15%] px-6 py-6 text-white">
          <div className="flex flex-col items-center gap-2">
            <IconBuildingStore className="h-7 w-7 opacity-80" />
            <span className="text-sm font-semibold">Entrar como Comprador</span>
          </div>

          <select
            value={compradorId}
            onChange={(e) => setCompradorId(e.target.value)}
            className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-white/40"
          >
            {compradores.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleConfirmar}
            className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primario)] transition-opacity hover:opacity-90"
          >
            {esVerTodo ? "Ver todos los compradores" : "Confirmar y entrar como comprador"}
          </button>

          <button
            type="button"
            onClick={() => setSeleccionando(false)}
            className="text-xs text-white/50 transition-colors hover:text-white/80"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={handleCompradorClick} className={CARD_BASE}>
          <IconBuildingStore className="h-8 w-8" />
          <span className="text-base font-semibold">Entrar como Comprador</span>
        </button>
      )}

      {/* ── Tarjeta Proveedor (sin cambios) ───────────────────────────── */}
      <Link href={`${basePath}/proveedor`} className={CARD_BASE}>
        <IconTruck className="h-8 w-8" />
        <span className="text-base font-semibold">Entrar como Proveedor</span>
      </Link>
    </div>
  );
}
