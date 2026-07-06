"use client";

import {
  IconMessageCircle,
  IconPlayerSkipForward,
  IconReceipt,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import CountdownTimer from "@/src/components/CountdownTimer";
import ChatWidget from "@/src/components/Chat/ChatWidget";
import { forzarAvanceRondaAction } from "@/src/lib/rondasActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";

// ── Types (exported for use in server page) ───────────────────────────────────

export type OfertaDetalle = {
  productoNombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  precioUnitario: number | null;
  cantidadDisponible: number | null;
  puedeCumplirFecha: boolean | null;
  fechaEstimadaEntrega: string | null;
};

export type ProveedorParticipante = {
  id: string;
  razonSocial: string;
  cotizó: boolean;
  ultimaCotizacion: string | null;
  ofertaDetalle: OfertaDetalle[];
};

export type MejorPrecioItem = {
  productoNombre: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  mejor: {
    precioUnitario: number;
    proveedorNombre: string;
    ronda: number;
    cantidadDisponible: number;
  } | null;
  segundo: {
    precioUnitario: number;
    proveedorNombre: string;
    ronda: number;
    cantidadDisponible: number;
    cantidadNecesaria: number;
  } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeso(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DetalleLicitacion({
  id,
  numero,
  estado,
  rondaActual,
  maxRondas,
  rondaFinMs,
  esperandoDecision,
  participantes,
  mejoresPrecioItems,
  basePath,
  noLeidosPorProveedor = {},
}: {
  id: string;
  numero: string;
  estado: string;
  rondaActual: number;
  maxRondas: number;
  rondaFinMs: number | null;
  esperandoDecision: boolean;
  participantes: ProveedorParticipante[];
  mejoresPrecioItems: MejorPrecioItem[];
  basePath: string;
  noLeidosPorProveedor?: Record<string, number>;
}) {
  const router = useRouter();
  usePageTitle(`Licitación ${numero}`);
  const [tab, setTab] = useState<"participantes" | "mejores">("participantes");
  const [modalProveedor, setModalProveedor] =
    useState<ProveedorParticipante | null>(null);
  const [chatProveedorId, setChatProveedorId] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);

  const cotizaron = participantes.filter((p: any) => p.cotizó).length;

  async function handleForzar() {
    const esUltima = rondaActual >= maxRondas;
    const msg = esUltima
      ? `¿Forzar el cierre de la Ronda ${rondaActual} (última)? Se activará el proceso de decisión final.`
      : `¿Forzar el avance a la Ronda ${rondaActual + 1}?`;
    if (!window.confirm(msg)) return;
    setForzando(true);
    await forzarAvanceRondaAction(id, basePath);
    router.refresh();
    setForzando(false);
  }

  const TAB_BTN = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-[var(--color-primario)] text-[var(--color-primario)]"
        : "border-transparent text-zinc-500 hover:text-zinc-800"
    }`;

  const chatProveedor = chatProveedorId
    ? participantes.find((p: any)  => p.id === chatProveedorId) ?? null
    : null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] px-6 py-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/comprador/licitaciones-proceso`}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              ← Licitaciones en Proceso
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {estado}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Ronda {rondaActual === 0 ? "—" : rondaActual} de {maxRondas}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Participación */}
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700">
            <span className="font-semibold text-zinc-900">{cotizaron}</span>
            {" de "}
            <span className="font-semibold text-zinc-900">
              {participantes.length}
            </span>
            {" proveedores han cotizado"}
          </span>

          {/* Timer */}
          {esperandoDecision ? (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
              Revisando resultados finales
            </span>
          ) : rondaFinMs === null ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-500">
              Por iniciar
            </span>
          ) : (
            <CountdownTimer fechaFin={new Date(rondaFinMs)} precision="seconds" />
          )}

          {/* Forzar avance */}
          {!esperandoDecision && rondaActual > 0 && (
            <button
              type="button"
              onClick={handleForzar}
              disabled={forzando}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <IconPlayerSkipForward className="h-4 w-4" />
              Forzar cierre de ronda
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setTab("participantes")}
            className={TAB_BTN(tab === "participantes")}
          >
            Participantes
          </button>
          <button
            type="button"
            onClick={() => setTab("mejores")}
            className={TAB_BTN(tab === "mejores")}
          >
            Mejores Precios
          </button>
        </div>

        {/* ── Tab: Participantes ─────────────────────────────────────────── */}
        {tab === "participantes" && (
          <div className="mt-4 overflow-x-auto bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Estado en ronda</th>
                  <th className="min-w-[160px] px-4 py-3">Última cotización</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {participantes.map((p: any)=> {
                  const noLeidos = noLeidosPorProveedor[p.id] ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {p.razonSocial}
                      </td>
                      <td className="px-4 py-3">
                        {p.cotizó ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            Cotizó
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {p.ultimaCotizacion
                          ? formatFechaHora(p.ultimaCotizacion)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Chat button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setChatProveedorId(p.id)}
                              title={`Chat con ${p.razonSocial}`}
                              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                            >
                              <IconMessageCircle className="h-4 w-4" />
                            </button>
                            {noLeidos > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                                {noLeidos > 9 ? "9+" : noLeidos}
                              </span>
                            )}
                          </div>
                          {/* Ver oferta */}
                          <button
                            type="button"
                            onClick={() => setModalProveedor(p)}
                            disabled={!p.cotizó}
                            title={p.cotizó ? "Ver oferta" : "Sin oferta registrada"}
                            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <IconReceipt className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab: Mejores Precios ───────────────────────────────────────── */}
        {tab === "mejores" && (
          <div className="mt-4 overflow-x-auto bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <th className="min-w-[180px] px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cant. Solic.</th>
                  <th className="px-4 py-3">Unidad</th>
                  <th className="min-w-[130px] px-4 py-3 text-right">
                    Mejor Precio
                  </th>
                  <th className="min-w-[160px] px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-center">Ronda</th>
                  <th className="px-4 py-3 text-right">Cant. Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {mejoresPrecioItems.map((item, i) => (
                  <Fragment key={i}>
                    {/* Fila principal — mejor precio */}
                    <tr className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {item.productoNombre}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">
                        {item.cantidadSolicitada}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {item.unidadMedida}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.mejor ? (
                          <span className="font-semibold text-emerald-700">
                            {formatPeso(item.mejor.precioUnitario)}
                          </span>
                        ) : (
                          <span className="text-zinc-300">Sin ofertas</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {item.mejor?.proveedorNombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500">
                        {item.mejor ? `R${item.mejor.ronda}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">
                        {item.mejor != null ? (
                          <span
                            className={
                              item.mejor.cantidadDisponible <
                              item.cantidadSolicitada
                                ? "font-medium text-amber-600"
                                : ""
                            }
                          >
                            {item.mejor.cantidadDisponible}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>

                    {/* Fila secundaria — segundo mejor (cantidad parcial) */}
                    {item.segundo && (
                      <tr className="bg-amber-50/40 hover:bg-amber-50/60">
                        <td className="py-2 pl-10 pr-4">
                          <span className="text-xs text-amber-700">
                            ↳ Complemento (
                            {item.segundo.cantidadNecesaria} adicionales)
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-zinc-400">
                          {item.segundo.cantidadNecesaria}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-400">
                          {item.unidadMedida}
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-medium text-zinc-700">
                          {formatPeso(item.segundo.precioUnitario)}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-600">
                          {item.segundo.proveedorNombre}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-zinc-400">
                          R{item.segundo.ronda}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-zinc-400">
                          {item.segundo.cantidadDisponible}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Ver oferta de proveedor ───────────────────────────────────── */}
      {modalProveedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Oferta de {modalProveedor.razonSocial}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Ronda {rondaActual} — cotizado el{" "}
                  {modalProveedor.ultimaCotizacion
                    ? formatFechaHora(modalProveedor.ultimaCotizacion)
                    : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalProveedor(null)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            {/* Tabla de productos */}
            <div className="overflow-x-auto px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-400">
                    <th className="pb-2">Producto</th>
                    <th className="pb-2 text-right">Cant. Solic.</th>
                    <th className="pb-2 text-right">Cant. Disponible</th>
                    <th className="pb-2 text-right">Precio Unitario</th>
                    <th className="pb-2 text-center">¿Cumple fecha?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {modalProveedor.ofertaDetalle.map((d, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium text-zinc-800">
                        {d.productoNombre}
                        <span className="ml-1 text-xs text-zinc-400">
                          {d.unidadMedida}
                        </span>
                      </td>
                      <td className="py-2 text-right text-zinc-600">
                        {d.cantidadSolicitada}
                      </td>
                      <td className="py-2 text-right text-zinc-600">
                        {d.cantidadDisponible ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        {d.precioUnitario != null ? (
                          <span className="font-medium text-zinc-800">
                            {formatPeso(d.precioUnitario)}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {d.puedeCumplirFecha === null ? (
                          <span className="text-zinc-300">—</span>
                        ) : d.puedeCumplirFecha ? (
                          <span className="text-xs font-medium text-emerald-700">
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-red-600">
                            No
                            {d.fechaEstimadaEntrega && (
                              <span className="ml-1 font-normal text-zinc-400">
                                (
                                {new Date(
                                  d.fechaEstimadaEntrega
                                ).toLocaleDateString("es-MX", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                                )
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalProveedor(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Chat con proveedor ─────────────────────────────────────────── */}
      {chatProveedor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center"
          onClick={() => setChatProveedorId(null)}
        >
          <div
            className="flex h-[560px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">Chat</p>
                <h2 className="text-sm font-semibold text-zinc-900">
                  {chatProveedor.razonSocial}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setChatProveedorId(null)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            {/* Chat widget */}
            <div className="flex-1 overflow-hidden">
              <ChatWidget
                licitacionId={id}
                proveedorId={chatProveedor.id}
                emisor="comprador"
                nombreProveedor={chatProveedor.razonSocial}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
