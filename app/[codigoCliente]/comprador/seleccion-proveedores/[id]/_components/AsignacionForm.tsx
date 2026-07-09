"use client";

import { IconDownload, IconPencil, IconRefresh, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  confirmarAsignacionesAction,
  finalizarSinEsperarAction,
  type FilaAsignacion,
} from "@/src/lib/asignacionActions";
import { formatImporte } from "@/src/lib/monedas";
import { cancelarLicitacionAction } from "@/src/lib/rondasActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import type {
  ItemParaAsignacion,
  LicitacionInfo,
  OfertaParaDropdown,
} from "./types";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── State types ───────────────────────────────────────────────────────────────

type FilaState = {
  proveedorId: string;
  cantidad: number;
  // Precio y fecha son editables por el comprador; parten del valor de la
  // oferta pero se pueden ajustar manualmente (negociación, corrección, etc.).
  precioUnitario: number;
  fechaEstimada: string; // "" = cumple la fecha objetivo / sin estimado
};
type ItemAsignacion = { primary: FilaState; secondary: FilaState | null };

function precioDefault(o: OfertaParaDropdown | undefined): number {
  return o?.precioUnitario ?? 0;
}

function fechaDefault(o: OfertaParaDropdown | undefined): string {
  if (!o || o.puedeCumplirFecha || !o.fechaEstimadaEntrega) return "";
  return new Date(o.fechaEstimadaEntrega).toISOString().split("T")[0];
}

function initAsignacion(
  items: ItemParaAsignacion[]
): Record<string, ItemAsignacion> {
  const init: Record<string, ItemAsignacion> = {};
  for (const item of items) {
    const best = item.ofertas[0];
    if (!best) {
      init[item.licitacionItemId] = {
        primary: { proveedorId: "", cantidad: 0, precioUnitario: 0, fechaEstimada: "" },
        secondary: null,
      };
      continue;
    }
    const primaryCant = Math.min(best.cantidadDisponible, item.cantidadSolicitada);
    const resto = item.cantidadSolicitada - primaryCant;
    const second = resto > 0 ? item.ofertas[1] : null;
    init[item.licitacionItemId] = {
      primary: {
        proveedorId: best.proveedorId,
        cantidad: primaryCant,
        precioUnitario: precioDefault(best),
        fechaEstimada: fechaDefault(best),
      },
      secondary: second
        ? {
            proveedorId: second.proveedorId,
            cantidad: resto,
            precioUnitario: precioDefault(second),
            fechaEstimada: fechaDefault(second),
          }
        : null,
    };
  }
  return init;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function generarPDF(
  licitacion: LicitacionInfo,
  items: ItemParaAsignacion[],
  asignacion: Record<string, ItemAsignacion>
) {
  type GrupoProveedor = { nombre: string; filas: { material: string; cantidad: number; unidad: string; moneda: string; precio: number; subtotal: number }[] };
  const grupos = new Map<string, GrupoProveedor>();

  for (const item of items) {
    const fila = asignacion[item.licitacionItemId];
    if (!fila) continue;
    const addFila = (pId: string, cant: number, precio: number) => {
      if (!pId) return;
      const oferta = item.ofertas.find((o: any) => o.proveedorId === pId);
      if (!oferta) return;
      if (!grupos.has(pId)) grupos.set(pId, { nombre: oferta.proveedorNombre, filas: [] });
      grupos.get(pId)!.filas.push({
        material: item.productoNombre,
        cantidad: cant,
        unidad: item.unidadMedida,
        moneda: item.moneda,
        precio,
        subtotal: cant * precio,
      });
    };
    // Usa el precio EDITADO (lo que realmente se va a guardar), no el original de la oferta.
    addFila(fila.primary.proveedorId, fila.primary.cantidad, fila.primary.precioUnitario);
    if (fila.secondary) {
      addFila(fila.secondary.proveedorId, fila.secondary.cantidad, fila.secondary.precioUnitario);
    }
  }

  const totalesPDF: Record<string, number> = {};
  for (const g of grupos.values()) {
    for (const f of g.filas) {
      totalesPDF[f.moneda] = (totalesPDF[f.moneda] ?? 0) + f.subtotal;
    }
  }

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Licitación ${licitacion.numero}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 30px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; margin-bottom: 20px; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .total { font-weight: bold; font-size: 13px; text-align: right; margin-top: 16px; }
</style></head><body>
<h1>Licitación ${licitacion.numero}</h1>
<div class="meta">
  ${licitacion.jerarquia ? `Criticidad: ${licitacion.jerarquia} &nbsp;|&nbsp;` : ""}
  ${licitacion.tipoLicitacion ? `Tipo: ${licitacion.tipoLicitacion} &nbsp;|&nbsp;` : ""}
  Comprador: Comprador 1
</div>
${[...grupos.entries()]
  .map(
    ([, g]) => `
  <h2>Proveedor: ${g.nombre}</h2>
  <table>
    <thead><tr>
      <th>Material</th><th class="right">Cantidad</th><th>Unidad</th><th>Moneda</th>
      <th class="right">Precio Unit.</th><th class="right">Subtotal</th>
    </tr></thead>
    <tbody>
      ${g.filas
        .map(
          (f) =>
            `<tr>
          <td>${f.material}</td>
          <td class="right">${f.cantidad}</td>
          <td>${f.unidad}</td>
          <td>${f.moneda}</td>
          <td class="right">${formatImporte(f.precio, f.moneda)}</td>
          <td class="right">${formatImporte(f.subtotal, f.moneda)}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>`
  )
  .join("")}
<div class="total">${Object.entries(totalesPDF).map(([m, v]) => `Total ${m}: ${formatImporte(v, m)}`).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</div>
<script>window.print();</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AsignacionForm({
  licitacion,
  items,
  basePath,
}: {
  licitacion: LicitacionInfo;
  items: ItemParaAsignacion[];
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle(`Licitación ${licitacion.numero}`);
  const [tiempoHoras, setTiempoHoras] = useState(licitacion.tiempoConfirmacionHoras);
  const [asignacion, setAsignacion] = useState<Record<string, ItemAsignacion>>(
    () => initAsignacion(items)
  );
  const [guardando, setGuardando] = useState<"confirmar" | "finalizar" | null>(null);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [toggleCancelar, setToggleCancelar] = useState(false);
  const [textoCancelar, setTextoCancelar] = useState("");
  const [cancelando, setCancelando] = useState(false);

  function getOferta(item: ItemParaAsignacion, proveedorId: string): OfertaParaDropdown | undefined {
    return item.ofertas.find((o: any) => o.proveedorId === proveedorId);
  }

  function updatePrimaryProveedor(itemId: string, newProveedorId: string) {
    const item = items.find((i) => i.licitacionItemId === itemId)!;
    const oferta = getOferta(item, newProveedorId);
    const primaryCant = oferta
      ? Math.min(oferta.cantidadDisponible, item.cantidadSolicitada)
      : 0;
    const resto = item.cantidadSolicitada - primaryCant;
    let secondary: FilaState | null = null;
    if (resto > 0) {
      const alt = item.ofertas.find((o: any) => o.proveedorId !== newProveedorId);
      if (alt) {
        secondary = {
          proveedorId: alt.proveedorId,
          cantidad: resto,
          precioUnitario: precioDefault(alt),
          fechaEstimada: fechaDefault(alt),
        };
      }
    }
    setAsignacion((prev) => ({
      ...prev,
      [itemId]: {
        primary: {
          proveedorId: newProveedorId,
          cantidad: primaryCant,
          precioUnitario: precioDefault(oferta),
          fechaEstimada: fechaDefault(oferta),
        },
        secondary,
      },
    }));
  }

  function updatePrimaryCantidad(itemId: string, newCant: number) {
    const item = items.find((i) => i.licitacionItemId === itemId)!;
    setAsignacion((prev) => {
      const fila = prev[itemId];
      const resto = item.cantidadSolicitada - newCant;
      let secondary = fila.secondary;
      if (resto > 0) {
        if (!secondary) {
          const alt = item.ofertas.find((o: any) => o.proveedorId !== fila.primary.proveedorId);
          secondary = alt
            ? {
                proveedorId: alt.proveedorId,
                cantidad: resto,
                precioUnitario: precioDefault(alt),
                fechaEstimada: fechaDefault(alt),
              }
            : null;
        } else {
          secondary = { ...secondary, cantidad: resto };
        }
      } else {
        secondary = null;
      }
      return { ...prev, [itemId]: { ...fila, primary: { ...fila.primary, cantidad: newCant }, secondary } };
    });
  }

  function updateSecondaryProveedor(itemId: string, newProveedorId: string) {
    const item = items.find((i) => i.licitacionItemId === itemId)!;
    const oferta = getOferta(item, newProveedorId);
    setAsignacion((prev) => {
      const fila = prev[itemId];
      if (!fila.secondary) return prev;
      return {
        ...prev,
        [itemId]: {
          ...fila,
          secondary: {
            ...fila.secondary,
            proveedorId: newProveedorId,
            precioUnitario: precioDefault(oferta),
            fechaEstimada: fechaDefault(oferta),
          },
        },
      };
    });
  }

  function updatePrimaryPrecio(itemId: string, value: number) {
    setAsignacion((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], primary: { ...prev[itemId].primary, precioUnitario: value } },
    }));
  }

  function updatePrimaryFecha(itemId: string, value: string) {
    setAsignacion((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], primary: { ...prev[itemId].primary, fechaEstimada: value } },
    }));
  }

  function resetPrimary(itemId: string) {
    const item = items.find((i) => i.licitacionItemId === itemId)!;
    setAsignacion((prev) => {
      const fila = prev[itemId];
      const oferta = getOferta(item, fila.primary.proveedorId);
      return {
        ...prev,
        [itemId]: {
          ...fila,
          primary: {
            ...fila.primary,
            precioUnitario: precioDefault(oferta),
            fechaEstimada: fechaDefault(oferta),
          },
        },
      };
    });
  }

  function updateSecondaryPrecio(itemId: string, value: number) {
    setAsignacion((prev) => {
      const fila = prev[itemId];
      if (!fila.secondary) return prev;
      return { ...prev, [itemId]: { ...fila, secondary: { ...fila.secondary, precioUnitario: value } } };
    });
  }

  function updateSecondaryFecha(itemId: string, value: string) {
    setAsignacion((prev) => {
      const fila = prev[itemId];
      if (!fila.secondary) return prev;
      return { ...prev, [itemId]: { ...fila, secondary: { ...fila.secondary, fechaEstimada: value } } };
    });
  }

  function resetSecondary(itemId: string) {
    const item = items.find((i) => i.licitacionItemId === itemId)!;
    setAsignacion((prev) => {
      const fila = prev[itemId];
      if (!fila.secondary) return prev;
      const oferta = getOferta(item, fila.secondary.proveedorId);
      return {
        ...prev,
        [itemId]: {
          ...fila,
          secondary: {
            ...fila.secondary,
            precioUnitario: precioDefault(oferta),
            fechaEstimada: fechaDefault(oferta),
          },
        },
      };
    });
  }

  function updateSecondaryCantidad(itemId: string, newCant: number) {
    setAsignacion((prev) => {
      const fila = prev[itemId];
      if (!fila.secondary) return prev;
      return { ...prev, [itemId]: { ...fila, secondary: { ...fila.secondary, cantidad: newCant } } };
    });
  }

  function buildFilas(): FilaAsignacion[] {
    const filas: FilaAsignacion[] = [];
    for (const item of items) {
      const fila = asignacion[item.licitacionItemId];
      if (!fila?.primary.proveedorId) continue;
      const o1 = getOferta(item, fila.primary.proveedorId);
      if (o1) {
        filas.push({
          licitacionItemId: item.licitacionItemId,
          proveedorId: fila.primary.proveedorId,
          cantidadAsignada: fila.primary.cantidad,
          // Se guarda el valor EDITADO por el comprador, no el original de la oferta.
          precioUnitario: fila.primary.precioUnitario,
          moneda: item.moneda,
          ronda: o1.ronda,
          orden: 1,
          fechaObjetivo: item.fechaEntrega,
          fechaEstimadaProveedor: fila.primary.fechaEstimada || null,
        });
      }
      if (fila.secondary?.proveedorId) {
        const o2 = getOferta(item, fila.secondary.proveedorId);
        if (o2) {
          filas.push({
            licitacionItemId: item.licitacionItemId,
            proveedorId: fila.secondary.proveedorId,
            cantidadAsignada: fila.secondary.cantidad,
            precioUnitario: fila.secondary.precioUnitario,
            moneda: item.moneda,
            ronda: o2.ronda,
            orden: 2,
            fechaObjetivo: item.fechaEntrega,
            fechaEstimadaProveedor: fila.secondary.fechaEstimada || null,
          });
        }
      }
    }
    return filas;
  }

  async function handleConfirmar() {
    setGuardando("confirmar");
    await confirmarAsignacionesAction(licitacion.id, buildFilas(), tiempoHoras, basePath);
    router.refresh();
    setGuardando(null);
  }

  async function handleFinalizar() {
    if (!window.confirm("¿Finalizar sin esperar confirmación de proveedores?")) return;
    setGuardando("finalizar");
    await finalizarSinEsperarAction(licitacion.id, buildFilas(), basePath);
    router.refresh();
    setGuardando(null);
  }

  function cerrarModalCancelar() {
    setModalCancelar(false);
    setToggleCancelar(false);
    setTextoCancelar("");
  }

  async function handleCancelar() {
    setCancelando(true);
    await cancelarLicitacionAction(licitacion.id, basePath);
    setCancelando(false);
    cerrarModalCancelar();
    router.push(`${basePath}/comprador/seleccion-proveedores`);
  }

  const cancelarHabilitado =
    toggleCancelar && textoCancelar.trim().toLowerCase() === "cancelar";

  // Totales por moneda — usa el precio EDITADO por el comprador (fila.*.precioUnitario),
  // no el original de la oferta, para que reflejen cualquier ajuste manual en vivo.
  const totalesPorMoneda = items.reduce((acc: any, item: any) => {
    const fila = asignacion[item.licitacionItemId];
    if (!fila) return acc;
    const sub1 = fila.primary.proveedorId
      ? fila.primary.cantidad * fila.primary.precioUnitario
      : 0;
    const sub2 = fila.secondary?.proveedorId
      ? fila.secondary.cantidad * fila.secondary.precioUnitario
      : 0;
    const moneda = item.moneda ?? "MXN";
    acc[moneda] = (acc[moneda] ?? 0) + sub1 + sub2;
    return acc;
  }, {} as Record<string, number>);
  const costoTotal = Object.values(totalesPorMoneda).reduce((s: any, v: any) => s + v, 0)as number;

  const margen = licitacion.importeVenta != null ? licitacion.importeVenta - costoTotal : null;
  const pctMargen = margen != null && licitacion.importeVenta ? (margen / licitacion.importeVenta) * 100 : null;

  // Conteo de precios/fechas modificados manualmente vs. la oferta original — para
  // el aviso superior y para el indicador "modificado" en cada celda.
  let totalModificaciones = 0;
  for (const item of items as any[]) {
    const fila = asignacion[item.licitacionItemId];
    if (!fila) continue;
    const o1 = fila.primary.proveedorId ? getOferta(item, fila.primary.proveedorId) : undefined;
    if (o1) {
      if (fila.primary.precioUnitario !== precioDefault(o1)) totalModificaciones++;
      if (fila.primary.fechaEstimada !== fechaDefault(o1)) totalModificaciones++;
    }
    const o2 = fila.secondary?.proveedorId ? getOferta(item, fila.secondary.proveedorId) : undefined;
    if (o2 && fila.secondary) {
      if (fila.secondary.precioUnitario !== precioDefault(o2)) totalModificaciones++;
      if (fila.secondary.fechaEstimada !== fechaDefault(o2)) totalModificaciones++;
    }
  }

  const CELL = "px-3 py-2 text-sm";
  const INPUT_CLS = "w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`${basePath}/comprador/seleccion-proveedores`}
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            ← Selección de Proveedores
          </Link>
          <p className="text-sm text-zinc-500">
            {[licitacion.jerarquia, licitacion.tipoLicitacion, "Comprador 1"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <label className="text-sm font-medium text-zinc-700">
            Tiempo límite de confirmación
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={720}
              value={tiempoHoras}
              onChange={(e) => setTiempoHoras(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm text-zinc-500">horas</span>
          </div>
        </div>
      </div>

      {/* Aviso de modificaciones manuales */}
      {totalModificaciones > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <IconPencil className="h-4 w-4 shrink-0" />
          <span>
            Has modificado {totalModificaciones}{" "}
            {totalModificaciones === 1 ? "precio/fecha" : "precios/fechas"} respecto a
            las ofertas originales.
          </span>
        </div>
      )}

      {/* Tabla de asignación */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="min-w-[160px] px-3 py-3">Material</th>
              <th className="min-w-[80px] px-3 py-3 text-right">Cant. / Unidad</th>
              <th className="min-w-[280px] px-3 py-3">Proveedor asignado</th>
              <th className="min-w-[90px] px-3 py-3 text-right">Cant. asignada</th>
              <th className="min-w-[110px] px-3 py-3">Fecha objetivo</th>
              <th className="min-w-[150px] px-3 py-3">Fecha estimada prov.</th>
              <th className="min-w-[120px] px-3 py-3 text-right">Precio unit.</th>
              <th className="min-w-[60px] px-3 py-3 text-center">Ronda</th>
              <th className="min-w-[110px] px-3 py-3 text-right">Subtotal</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item: any) => {
              const fila = asignacion[item.licitacionItemId];
              if (!fila) return null;

              const o1 = fila.primary.proveedorId
                ? getOferta(item, fila.primary.proveedorId)
                : null;
              const sub1 = o1 ? fila.primary.cantidad * fila.primary.precioUnitario : 0;
              const precioMod1 = !!o1 && fila.primary.precioUnitario !== precioDefault(o1);
              const fechaMod1 = !!o1 && fila.primary.fechaEstimada !== fechaDefault(o1);

              const o2 =
                fila.secondary?.proveedorId
                  ? getOferta(item, fila.secondary.proveedorId)
                  : null;
              const sub2 =
                o2 && fila.secondary ? fila.secondary.cantidad * fila.secondary.precioUnitario : 0;
              const precioMod2 = !!o2 && !!fila.secondary && fila.secondary.precioUnitario !== precioDefault(o2);
              const fechaMod2 = !!o2 && !!fila.secondary && fila.secondary.fechaEstimada !== fechaDefault(o2);

              const altParaSecundaria = item.ofertas.filter(
                (o: any) => o.proveedorId !== fila.primary.proveedorId
              );

              return (
                <Fragment key={item.licitacionItemId}>
                  {/* Fila principal */}
                  <tr className="hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className={`${CELL} font-medium text-zinc-800`}>
                      {item.productoNombre}
                    </td>
                    <td className={`${CELL} text-right text-zinc-600`}>
                      {item.cantidadSolicitada}
                      <span className="ml-1 text-xs text-zinc-400">
                        {item.unidadMedida}
                      </span>
                    </td>
                    <td className={CELL}>
                      {item.ofertas.length === 0 ? (
                        <span className="text-zinc-400">Sin ofertas</span>
                      ) : (
                        <select
                          value={fila.primary.proveedorId}
                          onChange={(e) =>
                            updatePrimaryProveedor(item.licitacionItemId, e.target.value)
                          }
                          className={INPUT_CLS}
                          style={{ minWidth: "240px" }}
                        >
                          {item.ofertas.map((o: any) => (
                            <option key={o.proveedorId} value={o.proveedorId}>
                              {o.proveedorNombre} — {formatImporte(o.precioUnitario, item.moneda)} (disp: {o.cantidadDisponible})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={`${CELL} text-right`}>
                      <input
                        type="number"
                        min={0}
                        value={fila.primary.cantidad}
                        onChange={(e) =>
                          updatePrimaryCantidad(
                            item.licitacionItemId,
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        className={`${INPUT_CLS} text-right`}
                      />
                    </td>
                    <td className={`${CELL} text-zinc-500`}>
                      {formatFecha(item.fechaEntrega)}
                    </td>
                    <td className={CELL}>
                      {o1 ? (
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="date"
                            value={fila.primary.fechaEstimada}
                            onChange={(e) =>
                              updatePrimaryFecha(item.licitacionItemId, e.target.value)
                            }
                            className={`${INPUT_CLS} ${fechaMod1 ? "border-amber-400 bg-amber-50/40" : ""}`}
                          />
                          {fechaMod1 ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                              <IconPencil className="h-2.5 w-2.5" /> modificado
                            </span>
                          ) : fila.primary.fechaEstimada === "" ? (
                            <span className="text-[10px] text-emerald-600">
                              Cumple fecha objetivo
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className={`${CELL} text-right`}>
                      {o1 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={fila.primary.precioUnitario}
                            onChange={(e) =>
                              updatePrimaryPrecio(
                                item.licitacionItemId,
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            className={`${INPUT_CLS} text-right ${precioMod1 ? "border-amber-400 bg-amber-50/40" : ""}`}
                          />
                          {precioMod1 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                              <IconPencil className="h-2.5 w-2.5" /> modificado
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${CELL} text-center`}>
                      {o1 && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                          R{o1.ronda}
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} text-right font-semibold text-zinc-800`}>
                      {o1 ? formatImporte(sub1, item.moneda) : "—"}
                    </td>
                    <td className={CELL}>
                      {o1 && (
                        <button
                          type="button"
                          onClick={() => resetPrimary(item.licitacionItemId)}
                          disabled={!precioMod1 && !fechaMod1}
                          title="Restablecer a la oferta original"
                          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <IconRefresh className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Fila secundaria */}
                  {fila.secondary && (
                    <tr className="bg-amber-50/40 hover:bg-amber-50/60 transition-colors duration-150">
                      <td className={`${CELL} pl-8 text-zinc-500`}>
                        <span className="text-xs">↳ {item.productoNombre} (resto)</span>
                      </td>
                      <td className={`${CELL} text-right text-xs text-zinc-400`}>
                        {item.cantidadSolicitada - fila.primary.cantidad}
                        <span className="ml-1">{item.unidadMedida}</span>
                      </td>
                      <td className={CELL}>
                        {altParaSecundaria.length === 0 ? (
                          <span className="text-xs text-zinc-400">Sin más ofertas</span>
                        ) : (
                          <select
                            value={fila.secondary.proveedorId}
                            onChange={(e) =>
                              updateSecondaryProveedor(item.licitacionItemId, e.target.value)
                            }
                            className={`${INPUT_CLS} text-xs`}
                            style={{ minWidth: "240px" }}
                          >
                            {altParaSecundaria.map((o: any) => (
                              <option key={o.proveedorId} value={o.proveedorId}>
                                {o.proveedorNombre} — {formatImporte(o.precioUnitario, item.moneda)} (disp: {o.cantidadDisponible})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={`${CELL} text-right`}>
                        <input
                          type="number"
                          min={0}
                          value={fila.secondary.cantidad}
                          onChange={(e) =>
                            updateSecondaryCantidad(
                              item.licitacionItemId,
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          className={`${INPUT_CLS} text-right text-xs`}
                        />
                      </td>
                      <td className={`${CELL} text-xs text-zinc-400`}>
                        {formatFecha(item.fechaEntrega)}
                      </td>
                      <td className={CELL}>
                        {o2 ? (
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="date"
                              value={fila.secondary.fechaEstimada}
                              onChange={(e) =>
                                updateSecondaryFecha(item.licitacionItemId, e.target.value)
                              }
                              className={`${INPUT_CLS} text-xs ${fechaMod2 ? "border-amber-400 bg-amber-50/40" : ""}`}
                            />
                            {fechaMod2 ? (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                                <IconPencil className="h-2.5 w-2.5" /> modificado
                              </span>
                            ) : fila.secondary.fechaEstimada === "" ? (
                              <span className="text-[10px] text-emerald-600">
                                Cumple fecha objetivo
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className={`${CELL} text-right`}>
                        {o2 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={fila.secondary.precioUnitario}
                              onChange={(e) =>
                                updateSecondaryPrecio(
                                  item.licitacionItemId,
                                  Math.max(0, Number(e.target.value))
                                )
                              }
                              className={`${INPUT_CLS} text-right text-xs ${precioMod2 ? "border-amber-400 bg-amber-50/40" : ""}`}
                            />
                            {precioMod2 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                                <IconPencil className="h-2.5 w-2.5" /> modificado
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${CELL} text-center`}>
                        {o2 && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                            R{o2.ronda}
                          </span>
                        )}
                      </td>
                      <td className={`${CELL} text-right text-sm font-semibold text-zinc-700`}>
                        {o2 && fila.secondary ? formatImporte(sub2, item.moneda) : "—"}
                      </td>
                      <td className={CELL}>
                        {o2 && (
                          <button
                            type="button"
                            onClick={() => resetSecondary(item.licitacionItemId)}
                            disabled={!precioMod2 && !fechaMod2}
                            title="Restablecer a la oferta original"
                            className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <IconRefresh className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>

          {/* Totales */}
          <tfoot>
            {Object.entries(totalesPorMoneda).map(([moneda, total], i) => (
              <tr key={moneda} className={`${i === 0 ? "border-t-2 border-zinc-200" : "border-t border-zinc-100"} bg-zinc-50`}>
                <td colSpan={9} className="px-3 py-3 text-right text-sm font-semibold text-zinc-700">
                  {i === 0 ? "Costo total de la licitación" : ""}
                  {Object.keys(totalesPorMoneda).length > 1 && (
                    <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{moneda}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-sm font-bold text-zinc-900">
                  {formatImporte(total as number, moneda)}
                </td>
              </tr>
            ))}
            {Object.keys(totalesPorMoneda).length === 0 && (
              <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                <td colSpan={9} className="px-3 py-3 text-right text-sm font-semibold text-zinc-700">Costo total de la licitación</td>
                <td className="px-3 py-3 text-right text-sm font-bold text-zinc-400">—</td>
              </tr>
            )}
            {margen != null && (
              <tr className="border-t border-zinc-100 bg-zinc-50">
                <td colSpan={9} className="px-3 py-2 text-right text-xs text-zinc-500">
                  $ Margen (Importe de venta {formatImporte(licitacion.importeVenta ?? 0, "MXN")} − Costo)
                </td>
                <td className={`px-3 py-2 text-right text-sm font-semibold ${margen >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatImporte(margen, "MXN")}
                  {pctMargen != null && (
                    <span className="ml-1.5 text-xs font-normal">({pctMargen.toFixed(1)}%)</span>
                  )}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
        </div>
      </div>

      {/* Botones */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={!!guardando}
          className="rounded-md bg-[var(--color-primario)] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50"
        >
          {guardando === "confirmar" ? "Guardando…" : "Confirmar y notificar ganadores"}
        </button>
        <button
          type="button"
          onClick={handleFinalizar}
          disabled={!!guardando}
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          {guardando === "finalizar" ? "Guardando…" : "Finalizar sin esperar confirmación"}
        </button>
        <button
          type="button"
          onClick={() => generarPDF(licitacion, items, asignacion)}
          className="ml-auto flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <IconDownload className="h-4 w-4" />
          Descargar PDF
        </button>
        {licitacion.estado === "Cerrada" && (
          <>
            <div className="h-6 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={() => setModalCancelar(true)}
              disabled={!!guardando}
              className="rounded-md border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar licitación
            </button>
          </>
        )}
      </div>

      {/* ── Modal: Cancelar licitación ──────────────────────────────────── */}
      {modalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Cancelar licitación
              </h2>
              <button
                type="button"
                onClick={cerrarModalCancelar}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={toggleCancelar}
                  onChange={(e) => setToggleCancelar(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-red-600"
                />
                <span className="text-sm text-zinc-700">
                  Entiendo que esta acción cancelará la licitación y no se
                  generarán órdenes de compra
                </span>
              </label>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">
                  Escribe CANCELAR para confirmar
                </label>
                <input
                  type="text"
                  value={textoCancelar}
                  onChange={(e) => setTextoCancelar(e.target.value)}
                  placeholder="CANCELAR"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={cerrarModalCancelar}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                No, regresar
              </button>
              <button
                type="button"
                onClick={handleCancelar}
                disabled={!cancelarHabilitado || cancelando}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancelando ? "Cancelando…" : "Cancelar licitación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
