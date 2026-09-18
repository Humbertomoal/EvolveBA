"use client";

import { IconCopy, IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buscarProductosBaseAction } from "@/src/lib/productosActions";
import type { ProductoBaseOpcion } from "@/src/lib/productoBaseTypes";

/**
 * "Partir de un material existente…" — solo en CREAR material.
 *
 * Elegir un material NO rellena el estado aquí: navega a `nuevo?base=<id>` y la
 * página vuelve a montar ProductoForm con ese material como valor inicial. Así
 * FileUpload (que lee sus archivos una sola vez al montar) y la autogeneración
 * de código arrancan limpios, y el prellenado sobrevive a un refresh.
 */
export default function SelectorMaterialBase({
  basePath,
  base,
  proveedoresBase,
  archivosBase,
  baseNoEncontrada,
}: {
  basePath: string;
  base?: { nombre: string; codigo: string };
  proveedoresBase: number;
  archivosBase: number;
  baseNoEncontrada: boolean;
}) {
  const router = useRouter();
  const rutaNuevo = `${basePath}/comprador/catalogo/nuevo`;

  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProductoBaseOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Búsqueda con debounce de 300 ms. `vigente` descarta respuestas que llegan
  // tarde de una búsqueda anterior (el usuario siguió escribiendo).
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarProductosBaseAction(texto);
        if (vigente) setResultados(r);
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, abierto]);

  // Cerrar el desplegable al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  function elegir(id: string) {
    setAbierto(false);
    setTexto("");
    router.push(`${rutaNuevo}?base=${encodeURIComponent(id)}`);
  }

  const heredados = [
    archivosBase > 0 && `${archivosBase} archivo${archivosBase === 1 ? "" : "s"}`,
    proveedoresBase > 0 &&
      `${proveedoresBase} proveedor${proveedoresBase === 1 ? "" : "es"}`,
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
      {base && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
          <p className="flex min-w-0 items-start gap-2">
            <IconCopy className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Basado en <span className="font-semibold">{base.nombre}</span> (
              {base.codigo}). El original no se modifica; ajusta lo que cambie.
              {heredados.length > 0 && (
                <span className="block text-xs text-blue-700">
                  Al guardar se copiarán {heredados.join(" y ")} del material base.
                </span>
              )}
            </span>
          </p>
          <button
            type="button"
            onClick={() => router.push(rutaNuevo)}
            className="shrink-0 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            Empezar en blanco
          </button>
        </div>
      )}

      {baseNoEncontrada && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          El material base ya no existe. Puedes elegir otro o capturar uno en blanco.
        </p>
      )}

      <div ref={contenedorRef} className="relative">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">
            {base ? "Partir de otro material existente" : "Partir de un material existente"}
            <span className="font-normal text-zinc-400"> (opcional)</span>
          </span>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setAbierto(true);
              }}
              onFocus={() => setAbierto(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAbierto(false);
                // Enter no debe enviar el formulario del material.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (resultados[0]) elegir(resultados[0].id);
                }
              }}
              placeholder="Buscar por nombre o código…"
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-8 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {texto && (
              <button
                type="button"
                onClick={() => setTexto("")}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </label>

        {abierto && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
            {buscando && resultados.length === 0 ? (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400">
                <IconLoader2 className="h-4 w-4 animate-spin" /> Buscando…
              </li>
            ) : resultados.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-400">Sin coincidencias</li>
            ) : (
              resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => elegir(r.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  >
                    <span className="min-w-0 truncate text-zinc-800">{r.nombre}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400">
                      {r.familia && <span>{r.familia}</span>}
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5">{r.codigo}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <p className="mt-1 text-xs text-zinc-400">
          Copia todos los datos del material elegido para crear uno nuevo. El código se
          genera de nuevo.
        </p>
      </div>
    </div>
  );
}
