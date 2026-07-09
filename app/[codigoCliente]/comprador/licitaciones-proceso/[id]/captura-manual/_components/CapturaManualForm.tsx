"use client";

import { IconCheck, IconChevronDown, IconChevronRight, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  guardarAvanceCapturaAction,
  finalizarCapturaManualAction,
  type OfertaManual,
} from "@/src/lib/capturaManualActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Item = {
  licitacionItemId: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  fechaEntrega: string | null;
};

type Proveedor = { id: string; razonSocial: string };

type OfertaExistente = {
  licitacionItemId: string;
  proveedorId: string;
  precioUnitario: number;
  cantidadDisponible: number;
};

type LicitacionInfo = {
  id: string;
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  estado: string;
};

type CeldaState = { precioUnitario: string; cantidadDisponible: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeso(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function initEstado(
  proveedores: Proveedor[],
  items: Item[],
  existentes: OfertaExistente[]
): Record<string, Record<string, CeldaState>> {
  const s: Record<string, Record<string, CeldaState>> = {};
  for (const p of proveedores) {
    s[p.id] = {};
    for (const item of items) {
      const ex = existentes.find(
        (o: any) => o.proveedorId === p.id && o.licitacionItemId === item.licitacionItemId
      );
      s[p.id][item.licitacionItemId] = {
        precioUnitario: ex ? String(ex.precioUnitario) : "",
        cantidadDisponible: ex ? String(ex.cantidadDisponible) : "",
      };
    }
  }
  return s;
}

function buildOfertas(
  proveedores: Proveedor[],
  items: Item[],
  estado: Record<string, Record<string, CeldaState>>
): OfertaManual[] {
  const ofertas: OfertaManual[] = [];
  for (const p of proveedores) {
    for (const item of items) {
      const celda = estado[p.id]?.[item.licitacionItemId];
      if (!celda) continue;
      const precio = parseFloat(celda.precioUnitario);
      const cantidad = parseFloat(celda.cantidadDisponible);
      if (precio > 0 || cantidad > 0) {
        ofertas.push({
          licitacionItemId: item.licitacionItemId,
          proveedorId: p.id,
          precioUnitario: precio || 0,
          cantidadDisponible: cantidad || 0,
        });
      }
    }
  }
  return ofertas;
}

function proveedorTieneOfertas(
  proveedorId: string,
  items: Item[],
  estado: Record<string, Record<string, CeldaState>>
): boolean {
  return items.some((item) => {
    const celda = estado[proveedorId]?.[item.licitacionItemId];
    return celda && (celda.precioUnitario !== "" || celda.cantidadDisponible !== "");
  });
}

const INPUT = "rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CapturaManualForm({
  licitacion,
  items,
  proveedores,
  ofertasExistentes,
  basePath,
}: {
  licitacion: LicitacionInfo;
  items: Item[];
  proveedores: Proveedor[];
  ofertasExistentes: OfertaExistente[];
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle(`Captura de Cotización — Licitación ${licitacion.numero}`);
  const [estado, setEstado] = useState<Record<string, Record<string, CeldaState>>>(
    () => initEstado(proveedores, items, ofertasExistentes)
  );
  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(proveedores.length > 0 ? [proveedores[0].id] : [])
  );
  const [guardando, setGuardando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setCelda(
    proveedorId: string,
    itemId: string,
    campo: keyof CeldaState,
    valor: string
  ) {
    setEstado((prev) => ({
      ...prev,
      [proveedorId]: {
        ...prev[proveedorId],
        [itemId]: { ...prev[proveedorId][itemId], [campo]: valor },
      },
    }));
  }

  async function handleGuardar() {
    setGuardando(true);
    const ofertas = buildOfertas(proveedores, items, estado);
    await guardarAvanceCapturaAction(licitacion.id, ofertas, basePath);
    setGuardando(false);
  }

  async function handleFinalizar() {
    setFinalizando(true);
    const ofertas = buildOfertas(proveedores, items, estado);
    await finalizarCapturaManualAction(licitacion.id, ofertas, basePath);
    setFinalizando(false);
    setModalFinalizar(false);
    router.push(`${basePath}/comprador/seleccion-proveedores`);
  }

  return (
    <div className="w-full max-w-5xl min-w-0 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href={`${basePath}/comprador/licitaciones-proceso`}
          className="text-sm text-zinc-400 hover:text-zinc-600"
        >
          ← Licitaciones en Proceso
        </Link>
        <p className="text-sm text-zinc-500">
          {[licitacion.jerarquia, licitacion.tipoLicitacion, "Comprador 1"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* Accordion per provider */}
      <div className="space-y-2">
        {proveedores.map((proveedor) => {
          const abierto = expandidos.has(proveedor.id);
          const tieneOfertas = proveedorTieneOfertas(proveedor.id, items, estado);
          return (
            <div
              key={proveedor.id}
              className="overflow-hidden rounded-card border border-border bg-white shadow-card"
            >
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggleExpandido(proveedor.id)}
                className="flex w-full items-center justify-between gap-3 bg-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-100"
              >
                <div className="flex items-center gap-2.5">
                  {tieneOfertas ? (
                    <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-zinc-800">
                    {proveedor.razonSocial}
                  </span>
                  {tieneOfertas && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Con datos
                    </span>
                  )}
                </div>
                {abierto ? (
                  <IconChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
              </button>

              {/* Accordion body */}
              {abierto && (
                <div className="w-full overflow-x-auto border-t border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                        <th className="w-40 px-2 py-2.5">Material</th>
                        <th className="w-24 px-2 py-2.5 text-right">
                          Cant. solicitada
                        </th>
                        <th className="w-20 px-2 py-2.5">Unidad</th>
                        <th className="w-28 px-2 py-2.5">Fecha entrega</th>
                        <th className="w-32 px-2 py-2.5">Precio unitario</th>
                        <th className="w-28 px-2 py-2.5">Cant. disponible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {items.map((item: any) => {
                        const celda = estado[proveedor.id]?.[item.licitacionItemId] ?? {
                          precioUnitario: "",
                          cantidadDisponible: "",
                        };
                        const precio = parseFloat(celda.precioUnitario) || 0;
                        return (
                          <tr key={item.licitacionItemId} className="hover:bg-zinc-50/50 transition-colors duration-150">
                            <td
                              className="max-w-40 truncate px-2 py-2.5 font-medium text-zinc-800"
                              title={item.productoNombre}
                            >
                              {item.productoNombre}
                            </td>
                            <td className="px-2 py-2.5 text-right text-zinc-600">
                              {item.cantidadSolicitada}
                            </td>
                            <td className="px-2 py-2.5 text-zinc-500">
                              {item.unidadMedida}
                            </td>
                            <td className="px-2 py-2.5 text-zinc-500">
                              {formatFecha(item.fechaEntrega)}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="relative w-28">
                                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-zinc-400 text-xs">
                                  $
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={celda.precioUnitario}
                                  onChange={(e) =>
                                    setCelda(
                                      proveedor.id,
                                      item.licitacionItemId,
                                      "precioUnitario",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  className={`${INPUT} w-28 pl-5`}
                                />
                              </div>
                              {precio > 0 && (
                                <p className="mt-0.5 text-xs text-zinc-400">
                                  Total: {formatPeso(precio * item.cantidadSolicitada)}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={celda.cantidadDisponible}
                                onChange={(e) =>
                                  setCelda(
                                    proveedor.id,
                                    item.licitacionItemId,
                                    "cantidadDisponible",
                                    e.target.value
                                  )
                                }
                                placeholder="0"
                                className={`${INPUT} w-24`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {proveedores.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          Sin proveedores invitados en esta licitación.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5">
        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando || finalizando}
          className="rounded-md bg-[var(--color-primario)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-secundario)] disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar avance"}
        </button>
        <button
          type="button"
          onClick={() => setModalFinalizar(true)}
          disabled={guardando || finalizando}
          className="rounded-md border border-[var(--color-primario)] px-5 py-2.5 text-sm font-medium text-[var(--color-primario)] transition-colors hover:bg-[var(--color-primario)]/5 disabled:opacity-50"
        >
          Finalizar cotización
        </button>
      </div>

      {/* ── Modal: Confirmar finalizar ──────────────────────────────────────── */}
      {modalFinalizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Finalizar captura de cotizaciones
              </h2>
              <button
                type="button"
                onClick={() => setModalFinalizar(false)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-zinc-700">
                ¿Finalizar la captura de cotizaciones? Esta licitación pasará a{" "}
                <strong>Selección de Proveedores</strong> y no podrás seguir editando
                las cotizaciones.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalFinalizar(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFinalizar}
                disabled={finalizando}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-secundario)] disabled:opacity-50"
              >
                {finalizando ? "Finalizando…" : "Sí, finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
