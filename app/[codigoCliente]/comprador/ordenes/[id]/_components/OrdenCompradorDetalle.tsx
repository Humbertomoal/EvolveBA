"use client";

import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import type { OrdenCompradorDetalle } from "../page";
import { actualizarEstatusOrdenAction } from "@/src/lib/ordenesActions";
import { formatImporte } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import Badge, { type BadgeVariant } from "@/src/components/Badge";

const ESTADOS = ["Pendiente", "En tránsito", "Entregada", "Recibida", "Cancelada"];

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

export default function OrdenCompradorDetalle({
  orden,
  basePath,
}: {
  orden: OrdenCompradorDetalle;
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle(orden.numero);
  const [isPending, startTransition] = useTransition();
  const [estadoLocal, setEstadoLocal] = useState(orden.estado);

  function handleCambioEstatus(nuevoEstado: string) {
    setEstadoLocal(nuevoEstado);
    startTransition(async () => {
      await actualizarEstatusOrdenAction(orden.id, nuevoEstado, basePath);
    });
  }

  const CELL = "px-4 py-3";

  const totalesPorMoneda = orden.lineas.reduce((acc, l) => {
    acc[l.moneda] = (acc[l.moneda] ?? 0) + l.subtotal;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push(`${basePath}/comprador/ordenes`)}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <IconArrowLeft className="h-4 w-4" />
        Órdenes de Compra
      </button>

      {/* Header card */}
      <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <EstatusBadge estado={estadoLocal} />
            </div>
            <p className="text-sm text-zinc-500">
              Licitación:{" "}
              <span className="font-medium text-zinc-700">{orden.licitacionNumero}</span>
              {orden.licitacionJerarquia && (
                <> · <span className="text-zinc-600">{orden.licitacionJerarquia}</span></>
              )}
            </p>
            <p className="text-sm text-zinc-500">
              Proveedor:{" "}
              <span className="font-medium text-zinc-700">{orden.proveedorRazonSocial}</span>
            </p>
          </div>
          <a
            href={`${basePath}/comprador/ordenes/${orden.id}/imprimir`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <IconDownload className="h-4 w-4" />
            Descargar PDF
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-zinc-400">Fecha de creación</p>
            <p className="mt-0.5 text-sm text-zinc-800">{formatFecha(orden.fechaCreacion)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">ETD</p>
            <p className="mt-0.5 text-sm text-zinc-800">{formatFecha(orden.fechaEstimadaEntrega)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-medium text-zinc-400">Actualizar estatus</p>
            <select
              value={estadoLocal}
              disabled={isPending}
              onChange={(e) => handleCambioEstatus(e.target.value)}
              className="mt-0.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Materiales</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="px-5 py-3">Producto / Material</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3">U/M</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3 text-right">Precio unitario</th>
                <th className="px-4 py-3">Entrega objetivo</th>
                <th className="px-4 py-3">Estimada proveedor</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orden.lineas.map((l: any) => (
                <tr key={l.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className="px-5 py-3 font-medium text-zinc-800">{l.productoNombre}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">
                    {l.cantidad.toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{l.unidadMedida}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{l.moneda}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">{formatImporte(l.precioUnitario, l.moneda)}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatFecha(l.fechaEntregaObjetivo)}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatFecha(l.fechaEstimadaProveedor)}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-800">{formatImporte(l.subtotal, l.moneda)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Object.entries(totalesPorMoneda).map(([moneda, total], i) => (
                <tr key={moneda} className={`${i === 0 ? "border-t-2 border-zinc-200" : "border-t border-zinc-100"} bg-zinc-50`}>
                  <td colSpan={7} className="px-5 py-3 text-right text-sm font-semibold text-zinc-700">
                    {i === 0 ? "Total general" : ""}
                    {Object.keys(totalesPorMoneda).length > 1 && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{moneda}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">
                    {formatImporte(total as number, moneda)}
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
