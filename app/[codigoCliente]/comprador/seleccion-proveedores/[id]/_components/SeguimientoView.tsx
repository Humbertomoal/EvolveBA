"use client";

import {
  IconCheck,
  IconClock,
  IconDownload,
  IconPencil,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  editarAsignacionPendienteAction,
  finalizarLicitacionAction,
  forzarCierreSeleccionAction,
  reasignarProveedorAction,
} from "@/src/lib/asignacionActions";
import { formatImporte } from "@/src/lib/monedas";
import {
  convertirAMoneda,
  faltanTiposCambio,
  notaTipoCambio,
} from "@/src/lib/conversionMoneda";
import {
  prepararResultadoInternoAction,
  type DatosResultadoInterno,
} from "@/src/lib/resultadoInternoActions";
import {
  prepararNotificacionesGanadoresAction,
  type DatosNotificacionesGanadores,
} from "@/src/lib/notificacionesGanadoresActions";
import type { TipoCorreo } from "@/src/lib/plantillasCorreo";
import type { AdjuntoCorreo } from "@/src/lib/emailService";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import Badge, { type BadgeVariant } from "@/src/components/Badge";
import ModalCorreo from "@/src/components/ModalCorreo";
import type {
  AsignacionDetalle,
  LicitacionInfo,
} from "./types";
import HistoricoPujas from "./HistoricoPujas";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// La fecha estimada puede venir prellenada con la fecha objetivo (ya no es
// null cuando cumple), así que "cumple" se determina comparando fechas, no
// por ausencia de valor.
function cumpleFechaObjetivo(
  fechaEstimadaProveedor: string | null,
  fechaObjetivo: string | null
): boolean {
  if (!fechaEstimadaProveedor) return true;
  if (!fechaObjetivo) return false;
  return (
    new Date(fechaEstimadaProveedor).getTime() <= new Date(fechaObjetivo).getTime()
  );
}

// Mapeo de estatus de proveedor -> variante de Badge más cercana.
// No existe una variante de negocio específica para "Aprobado"/"Confirmado",
// así que se usa la genérica "success" (mismo verde que tenían ambos antes).
const ESTATUS_VARIANT: Record<string, BadgeVariant> = {
  Pendiente: "pendiente",
  Aprobado: "success",
  Rechazado: "danger",
  Confirmado: "success",
};

// ── Countdown ─────────────────────────────────────────────────────────────────

function CountdownCell({ endMs }: { endMs: number | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endMs) return;
    const tick = () => setRemaining(endMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  if (!endMs || remaining === null) return <span className="text-zinc-300">—</span>;
  if (remaining <= 0)
    return <span className="text-xs font-medium text-red-600">Tiempo agotado</span>;

  const totalSecs = Math.floor(remaining / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const display =
    hrs > 0
      ? `${hrs}h ${pad(mins)}m`
      : `${pad(mins)}m ${pad(secs)}s`;

  const colorCls =
    totalSecs < 3600
      ? "text-red-600"
      : totalSecs < 7200
        ? "text-amber-600"
        : "text-zinc-600";

  return <span className={`text-xs font-mono font-medium ${colorCls}`}>{display}</span>;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function generarPDF(licitacion: LicitacionInfo, asignaciones: AsignacionDetalle[]) {
  const grupos = new Map<
    string,
    { nombre: string; filas: AsignacionDetalle[] }
  >();
  for (const a of asignaciones) {
    if (!grupos.has(a.proveedorId)) {
      grupos.set(a.proveedorId, { nombre: a.proveedorNombre, filas: [] });
    }
    grupos.get(a.proveedorId)!.filas.push(a);
  }

  const totalesPDF: Record<string, number> = {};
  for (const a of asignaciones) {
    const m = a.moneda ?? "MXN";
    totalesPDF[m] = (totalesPDF[m] ?? 0) + a.cantidadAsignada * a.precioUnitario;
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
  .badge { display: inline-block; padding: 1px 8px; border-radius: 12px; font-size: 10px; }
  .verde { background: #dcfce7; color: #15803d; }
  .gris { background: #f4f4f5; color: #52525b; }
  .rojo { background: #fee2e2; color: #dc2626; }
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
      <th class="right">Precio Unit.</th><th>Fecha Objetivo</th>
      <th>Fecha Est. Prov.</th><th class="right">Subtotal</th><th>Estatus</th>
    </tr></thead>
    <tbody>
      ${g.filas
        .map((a: any)=> {
          const badgeCls =
            a.estatusProveedor === "Aprobado" || a.estatusProveedor === "Confirmado"
              ? "verde"
              : a.estatusProveedor === "Rechazado"
                ? "rojo"
                : "gris";
          const mon = a.moneda ?? "MXN";
          return `<tr>
          <td>${a.productoNombre}</td>
          <td class="right">${a.cantidadAsignada}</td>
          <td>${a.unidadMedida}</td>
          <td>${mon}</td>
          <td class="right">${formatImporte(a.precioUnitario, mon)}</td>
          <td>${formatFecha(a.fechaObjetivo)}</td>
          <td>${formatFecha(a.fechaEstimadaProveedor)}</td>
          <td class="right">${formatImporte(a.cantidadAsignada * a.precioUnitario, mon)}</td>
          <td><span class="badge ${badgeCls}">${a.estatusProveedor}</span></td>
        </tr>`;
        })
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

// Un paso de la cola de correos (props que se pasan a ModalCorreo).
type PasoCorreo = {
  key: string;
  tipo: TipoCorreo;
  tituloModal: string;
  variables: Record<string, string>;
  destinatarios: string[];
  variablesPorDestinatario?: Record<string, Record<string, string>>;
  adjuntos?: AdjuntoCorreo[];
  aviso?: string;
};

// Cantidades en Float: se comparan con tolerancia para no marcar descuadre por
// el error de redondeo de un 0.1 + 0.2 (mismo criterio que AsignacionForm).
const EPSILON_CANTIDAD = 0.001;

function fmtCantidad(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 4 });
}

// Aviso (para el modal) de cuántos proveedores quedaron fuera por no tener correo.
function avisoExcluidos(n: number): string | undefined {
  if (n <= 0) return undefined;
  return `${n} proveedor${n === 1 ? "" : "es"} sin correo ${
    n === 1 ? "quedó" : "quedaron"
  } fuera de esta notificación.`;
}

// Fallbacks si una preparación revienta: el paso correspondiente queda sin
// destinatarios y simplemente no se ofrece, pero la cola abre igual.
const RESULTADO_VACIO: DatosResultadoInterno = {
  variables: {},
  destinatarios: [],
  adjuntos: [],
};
const NOTIF_VACIO: DatosNotificacionesGanadores = {
  ganadores: { variables: {}, destinatarios: [], variablesPorDestinatario: {}, excluidos: 0 },
  noGanadores: { variables: {}, destinatarios: [], variablesPorDestinatario: {}, excluidos: 0 },
};

// Corre las dos preparaciones en paralelo AISLANDO fallos: con Promise.all una
// excepción tumbaba ambas y la cola nunca abría. Con allSettled, si una falla la
// otra sigue viva y el modal se ofrece con lo que sí se pudo preparar.
async function prepararCorreos(licitacionId: string, origen: string) {
  const [r, n] = await Promise.allSettled([
    prepararResultadoInternoAction(licitacionId),
    prepararNotificacionesGanadoresAction(licitacionId),
  ]);
  console.log(`###COLA_CORREOS### [${origen}] preparaciones`, {
    resultadoInterno: r.status,
    notificaciones: n.status,
  });
  if (r.status === "rejected") {
    console.error(
      `###COLA_CORREOS### [${origen}] prepararResultadoInternoAction rechazó`,
      r.reason
    );
  }
  if (n.status === "rejected") {
    console.error(
      `###COLA_CORREOS### [${origen}] prepararNotificacionesGanadoresAction rechazó`,
      n.reason
    );
  }
  return {
    resultado: r.status === "fulfilled" ? r.value : RESULTADO_VACIO,
    notif: n.status === "fulfilled" ? n.value : NOTIF_VACIO,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SeguimientoView({
  licitacion,
  asignaciones,
  basePath,
  codigoCliente,
  proveedoresParticipantes,
}: {
  licitacion: LicitacionInfo;
  asignaciones: AsignacionDetalle[];
  basePath: string;
  codigoCliente: string;
  proveedoresParticipantes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  usePageTitle(`Licitación ${licitacion.numero} — Seguimiento`);
  const [modalReasignar, setModalReasignar] = useState<AsignacionDetalle | null>(null);
  const [nuevoProveedorId, setNuevoProveedorId] = useState<string>("");
  const [ejecutando, setEjecutando] = useState(false);
  // Edición de una asignación aún no validada por el proveedor.
  const [modalEditar, setModalEditar] = useState<AsignacionDetalle | null>(null);
  const [editCantidad, setEditCantidad] = useState<string>("");
  const [editFecha, setEditFecha] = useState<string>("");
  // Cola secuencial de correos tras forzar cierre: RESULTADO_INTERNO →
  // GANADORES → NO_GANADORES (misma mecánica que AsignacionForm).
  const [colaCorreos, setColaCorreos] = useState<PasoCorreo[]>([]);

  const todosConfirmados = asignaciones.every(
    (a) => a.estatusProveedor === "Confirmado" || a.estatusProveedor === "Aprobado"
  );
  // Ya finalizada: se ocultan ambos botones de cierre. Sin esto se podría
  // finalizar (y re-enviar los tres correos) tantas veces como se presione.
  const yaFinalizada = licitacion.estado === "Finalizada";

  const totalesPorMoneda = asignaciones.reduce((acc: any, a: any) => {
    const moneda = a.moneda ?? "MXN";
    acc[moneda] = (acc[moneda] ?? 0) + a.cantidadAsignada * a.precioUnitario;
    return acc;
  }, {} as Record<string, number>);
  // Moneda de consolidación de los totales de esta licitación.
  const monedaConsol = licitacion.monedaConsolidacion ?? "MXN";
  // Costo total agregado CONVERTIDO a la moneda de consolidación.
  const costoTotal = Object.entries(totalesPorMoneda).reduce(
    (s, [moneda, v]) =>
      s + convertirAMoneda(v as number, moneda, monedaConsol, licitacion.tiposCambio),
    0
  );

  // Nota/aviso de tipo de cambio para los totales de esta pantalla.
  const monedasEnUso = asignaciones.map((a: any) => a.moneda);
  const notaTC = notaTipoCambio(monedasEnUso, licitacion.tiposCambio, monedaConsol);
  const faltanTC = faltanTiposCambio(monedasEnUso, licitacion.tiposCambio, monedaConsol);

  // Importe de venta (capturado en MXN) convertido a la consolidación.
  const importeVentaConsol =
    licitacion.importeVenta != null
      ? convertirAMoneda(licitacion.importeVenta, "MXN", monedaConsol, licitacion.tiposCambio)
      : null;
  const margen = importeVentaConsol != null ? importeVentaConsol - costoTotal : null;
  const pctMargen =
    margen != null && importeVentaConsol ? (margen / importeVentaConsol) * 100 : null;

  // Atajo dentro de la etapa de validación: da por validadas las asignaciones
  // que ningún proveedor respondió. NO manda correos ni finaliza — al quedar
  // todo aprobado aparece "Finalizar licitación", que es quien hace ambas cosas.
  // Si aquí también se mandaran, ese camino los enviaría por duplicado.
  async function handleForzarCierre() {
    if (
      !window.confirm(
        "¿Dar por validadas las asignaciones pendientes? Quedarán como Aprobadas sin esperar la respuesta del proveedor."
      )
    )
      return;
    setEjecutando(true);
    await forzarCierreSeleccionAction(licitacion.id, basePath);
    console.log(
      "###COLA_CORREOS### [SeguimientoView] forzarCierreSeleccionAction OK (sin correos: los finales salen al finalizar)"
    );
    setEjecutando(false);
    router.refresh();
  }

  // MOMENTO 3: cierre definitivo. Sella "Finalizada" y ofrece la cola de 3
  // correos (RESULTADO_INTERNO → GANADORES → NO_GANADORES).
  async function handleFinalizarLicitacion() {
    if (
      !window.confirm(
        "¿Finalizar la licitación? Se enviarán los resultados internos y las notificaciones a proveedores."
      )
    )
      return;
    setEjecutando(true);
    await finalizarLicitacionAction(licitacion.id, basePath);
    console.log("###COLA_CORREOS### [SeguimientoView] finalizarLicitacionAction OK");
    // El router.refresh() se retrasa hasta VACIAR la cola: al refrescar, el
    // server component re-renderiza y el modal desaparecería a la mitad.
    const { resultado, notif } = await prepararCorreos(licitacion.id, "SeguimientoView");
    console.log("###COLA_CORREOS### [SeguimientoView] preparación lista", {
      resultadoDestinatarios: resultado.destinatarios.length,
      ganadoresDestinatarios: notif.ganadores.destinatarios.length,
      noGanadoresDestinatarios: notif.noGanadores.destinatarios.length,
    });
    setEjecutando(false);
    iniciarColaCorreos(resultado, notif);
  }

  // Arma y arranca la cola RESULTADO_INTERNO → GANADORES → NO_GANADORES,
  // incluyendo solo los pasos con destinatarios. Si ninguno tiene, refresca.
  function iniciarColaCorreos(
    resultado: DatosResultadoInterno,
    notif: DatosNotificacionesGanadores
  ) {
    const pasos: PasoCorreo[] = [];
    if (resultado.destinatarios.length > 0) {
      pasos.push({
        key: "resultado",
        tipo: "RESULTADO_INTERNO",
        tituloModal: "Resultados internos",
        variables: resultado.variables,
        destinatarios: resultado.destinatarios,
        adjuntos: resultado.adjuntos,
      });
    }
    if (notif.ganadores.destinatarios.length > 0) {
      pasos.push({
        key: "ganadores",
        tipo: "NOTIFICACION_GANADORES",
        tituloModal: "Notificar a ganadores",
        variables: notif.ganadores.variables,
        destinatarios: notif.ganadores.destinatarios,
        variablesPorDestinatario: notif.ganadores.variablesPorDestinatario,
        aviso: avisoExcluidos(notif.ganadores.excluidos),
      });
    }
    if (notif.noGanadores.destinatarios.length > 0) {
      pasos.push({
        key: "noGanadores",
        tipo: "NOTIFICACION_NO_GANADORES",
        tituloModal: "Notificar a no ganadores",
        variables: notif.noGanadores.variables,
        destinatarios: notif.noGanadores.destinatarios,
        variablesPorDestinatario: notif.noGanadores.variablesPorDestinatario,
        aviso: avisoExcluidos(notif.noGanadores.excluidos),
      });
    }
    console.log("###COLA_CORREOS### [SeguimientoView] iniciarColaCorreos", {
      pasos: pasos.map((p) => p.key),
      total: pasos.length,
      accion: pasos.length > 0 ? "setColaCorreos" : "router.refresh (cola vacía)",
    });
    if (pasos.length > 0) setColaCorreos(pasos);
    else router.refresh();
  }

  // Cierra/envía el modal actual y avanza; al vaciar la cola, recién refresca.
  function avanzarCola() {
    const resto = colaCorreos.slice(1);
    setColaCorreos(resto);
    if (resto.length === 0) router.refresh();
  }

  async function handleReasignar() {
    if (!modalReasignar || !nuevoProveedorId) return;
    const oferta = modalReasignar.ofertasAlternativas.find(
      (o: any) => o.proveedorId === nuevoProveedorId
    );
    if (!oferta) return;
    setEjecutando(true);
    await reasignarProveedorAction(
      modalReasignar.id,
      nuevoProveedorId,
      oferta.precioUnitario,
      oferta.ronda,
      oferta.puedeCumplirFecha ? null : oferta.fechaEstimadaEntrega,
      licitacion.tiempoConfirmacionHoras,
      licitacion.id,
      basePath
    );
    setModalReasignar(null);
    router.refresh();
    setEjecutando(false);
  }

  function openReasignar(a: AsignacionDetalle) {
    setNuevoProveedorId(a.ofertasAlternativas[0]?.proveedorId ?? "");
    setModalReasignar(a);
  }

  // Suma ya asignada de un material EXCLUYENDO una fila (la que se está
  // editando), para calcular cómo quedaría la cobertura con el valor nuevo.
  // Un material puede estar repartido entre proveedor primario y secundario.
  function sumaAsignadaDelItem(licitacionItemId: string, excluirId: string): number {
    return asignaciones
      .filter((a) => a.licitacionItemId === licitacionItemId && a.id !== excluirId)
      .reduce((suma, a) => suma + a.cantidadAsignada, 0);
  }

  function openEditar(a: AsignacionDetalle) {
    setEditCantidad(String(a.cantidadAsignada));
    setEditFecha(
      a.fechaEstimadaProveedor
        ? new Date(a.fechaEstimadaProveedor).toISOString().split("T")[0]
        : ""
    );
    setModalEditar(a);
  }

  async function handleEditar() {
    if (!modalEditar) return;
    const cantidad = parseFloat(editCantidad);
    if (!Number.isFinite(cantidad) || cantidad < 0) return;

    // Aviso (no bloqueo) si la edición deja el material descuadrado: el
    // comprador tiene la última palabra, igual que en AsignacionForm.
    const otras = sumaAsignadaDelItem(modalEditar.licitacionItemId, modalEditar.id);
    const nuevaSuma = otras + cantidad;
    if (Math.abs(nuevaSuma - modalEditar.cantidadSolicitada) >= EPSILON_CANTIDAD) {
      const diff = nuevaSuma - modalEditar.cantidadSolicitada;
      const detalle =
        diff < 0
          ? `faltarían ${fmtCantidad(-diff)} ${modalEditar.unidadMedida}`
          : `sobrarían ${fmtCantidad(diff)} ${modalEditar.unidadMedida}`;
      const ok = window.confirm(
        `Con este cambio, ${modalEditar.productoNombre} quedaría en ${fmtCantidad(nuevaSuma)} de ${fmtCantidad(modalEditar.cantidadSolicitada)} ${modalEditar.unidadMedida} (${detalle}).\n\nLa orden de compra se generará con la cantidad asignada.\n\n¿Guardar de todas formas?`
      );
      if (!ok) return;
    }

    setEjecutando(true);
    const { actualizada } = await editarAsignacionPendienteAction(
      modalEditar.id,
      cantidad,
      editFecha || null,
      licitacion.id,
      basePath
    );
    setEjecutando(false);
    setModalEditar(null);
    if (!actualizada) {
      window.alert(
        "Este material ya fue validado por el proveedor, así que no se guardaron los cambios. Se recargará la pantalla con el estado actual."
      );
    }
    router.refresh();
  }

  const CELL = "px-3 py-3 text-sm";

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

        <div className="flex flex-wrap items-center gap-2">
          {todosConfirmados && !yaFinalizada && (
            <button
              type="button"
              onClick={handleFinalizarLicitacion}
              disabled={ejecutando}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <IconCheck className="h-4 w-4" />
              {ejecutando ? "Finalizando…" : "Finalizar licitación"}
            </button>
          )}
          {/* Sin gate de yaFinalizada a propósito: no manda correos ni cambia
              el estado, así que sigue disponible para destrabar asignaciones
              pendientes en licitaciones que ya quedaron finalizadas. */}
          {!todosConfirmados && (
            <button
              type="button"
              onClick={handleForzarCierre}
              disabled={ejecutando}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Dar por validadas las pendientes
            </button>
          )}
          <button
            type="button"
            onClick={() => generarPDF(licitacion, asignaciones)}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <IconDownload className="h-4 w-4" />
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Aviso: faltan tipos de cambio */}
      {faltanTC && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Faltan tipos de cambio; los totales pueden ser incorrectos. Captúralos en
          la edición de la licitación.
        </div>
      )}

      {/* Tabla de seguimiento */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="min-w-[150px] px-3 py-3">Material</th>
              <th className="min-w-[160px] px-3 py-3">Proveedor</th>
              <th className="min-w-[80px] px-3 py-3 text-right">Cantidad</th>
              <th className="min-w-[110px] px-3 py-3 text-right">Precio unit.</th>
              <th className="min-w-[110px] px-3 py-3">Fecha objetivo</th>
              <th className="min-w-[140px] px-3 py-3">Fecha est. prov.</th>
              <th className="min-w-[110px] px-3 py-3">Estatus</th>
              <th className="min-w-[120px] px-3 py-3">Tiempo restante</th>
              <th className="min-w-[100px] px-3 py-3">OC</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {asignaciones.map((a: any) => (
              <tr
                key={a.id}
                className={`transition-colors duration-150 hover:bg-zinc-50/50 ${
                  a.orden > 1 ? "bg-amber-50/30" : ""
                }`}
              >
                <td className={`${CELL} font-medium text-zinc-800`}>
                  {a.orden > 1 ? (
                    <span className="text-zinc-500">
                      <span className="mr-1 text-zinc-300">↳</span>
                      {a.productoNombre}
                    </span>
                  ) : (
                    a.productoNombre
                  )}
                  <span className="ml-1 text-xs text-zinc-400">
                    {a.unidadMedida}
                  </span>
                </td>
                <td className={`${CELL} text-zinc-700`}>{a.proveedorNombre}</td>
                <td className={`${CELL} text-right text-zinc-600`}>
                  {a.cantidadAsignada}
                </td>
                <td className={`${CELL} text-right font-medium text-zinc-800`}>
                  {formatImporte(a.precioUnitario, a.moneda ?? "MXN")}
                </td>
                <td className={`${CELL} text-zinc-500`}>
                  {formatFecha(a.fechaObjetivo)}
                </td>
                <td className={CELL}>
                  {cumpleFechaObjetivo(a.fechaEstimadaProveedor, a.fechaObjetivo) ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Cumple fecha
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">
                      {formatFecha(a.fechaEstimadaProveedor)}
                    </span>
                  )}
                </td>
                <td className={CELL}>
                  <Badge variant={ESTATUS_VARIANT[a.estatusProveedor] ?? "neutral"}>
                    {a.estatusProveedor}
                  </Badge>
                  {a.motivoRechazo && (
                    <p className="mt-0.5 text-xs text-red-500">{a.motivoRechazo}</p>
                  )}
                </td>
                <td className={CELL}>
                  {a.estatusProveedor === "Pendiente" ? (
                    <div className="flex items-center gap-1 text-zinc-500">
                      <IconClock className="h-3.5 w-3.5 shrink-0" />
                      <CountdownCell
                        endMs={
                          a.fechaLimiteConfirmacion
                            ? new Date(a.fechaLimiteConfirmacion).getTime()
                            : null
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className={CELL}>
                  {a.ordenNumero ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {a.ordenNumero}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                {/* Acciones: los tres casos son mutuamente excluyentes.
                    Pendiente → Editar · Rechazado → Reasignar ·
                    Aprobado/Confirmado → nada (ya validado, con OC emitida). */}
                <td className={CELL}>
                  {a.estatusProveedor === "Pendiente" && (
                    <button
                      type="button"
                      onClick={() => openEditar(a)}
                      className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <IconPencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  )}
                  {a.estatusProveedor === "Rechazado" && (
                    <button
                      type="button"
                      onClick={() => openReasignar(a)}
                      className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <IconRefresh className="h-3.5 w-3.5" />
                      Reasignar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totales */}
          <tfoot>
            {/* Subtotales por moneda (informativo) — solo si hay más de una moneda */}
            {Object.keys(totalesPorMoneda).length > 1 &&
              Object.entries(totalesPorMoneda).map(([moneda, total]) => (
                <tr key={moneda} className="border-t border-zinc-100 bg-zinc-50">
                  <td colSpan={3} className="px-3 py-2 text-right text-xs text-zinc-500">
                    Subtotal
                    <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-600">{moneda}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-zinc-600">
                    {formatImporte(total as number, moneda)}
                  </td>
                  <td colSpan={6} />
                </tr>
              ))}
            {/* Costo total en MXN */}
            <tr className="border-t-2 border-zinc-200 bg-zinc-50">
              <td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold text-zinc-700">
                Costo total
                {notaTC && (
                  <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {monedaConsol}
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-zinc-900">
                {Object.keys(totalesPorMoneda).length > 0
                  ? formatImporte(costoTotal, monedaConsol)
                  : "—"}
              </td>
              <td colSpan={6} />
            </tr>
            {notaTC && (
              <tr className="bg-zinc-50">
                <td colSpan={4} className="px-3 pb-2 text-right text-[11px] text-zinc-400">
                  {notaTC}
                </td>
                <td colSpan={6} />
              </tr>
            )}
            {margen != null && (
              <tr className="border-t border-zinc-100 bg-zinc-50">
                <td colSpan={3} className="px-3 py-2 text-right text-xs text-zinc-500">$ Margen</td>
                <td className={`px-3 py-2 text-right text-sm font-semibold ${margen >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatImporte(margen, monedaConsol)}
                  {pctMargen != null && (
                    <span className="ml-1.5 text-xs font-normal">({pctMargen.toFixed(1)}%)</span>
                  )}
                </td>
                <td colSpan={6} />
              </tr>
            )}
          </tfoot>
        </table>
        </div>
      </div>

      <HistoricoPujas
        licitacionId={licitacion.id}
        licitacionNumero={licitacion.numero}
        proveedoresParticipantes={proveedoresParticipantes}
      />

      {/* Modal: Editar asignación pendiente */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Editar asignación
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {modalEditar.productoNombre} — {modalEditar.proveedorNombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalEditar(null)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Solicitado del material:{" "}
                <span className="font-medium text-zinc-800">
                  {fmtCantidad(modalEditar.cantidadSolicitada)} {modalEditar.unidadMedida}
                </span>
                {sumaAsignadaDelItem(modalEditar.licitacionItemId, modalEditar.id) > 0 && (
                  <>
                    {" · "}ya asignado a otros proveedores:{" "}
                    <span className="font-medium text-zinc-800">
                      {fmtCantidad(
                        sumaAsignadaDelItem(modalEditar.licitacionItemId, modalEditar.id)
                      )}{" "}
                      {modalEditar.unidadMedida}
                    </span>
                  </>
                )}
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">
                  Cantidad asignada ({modalEditar.unidadMedida})
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={editCantidad}
                  onChange={(e) => setEditCantidad(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">
                  Fecha estimada del proveedor
                </label>
                <input
                  type="date"
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[11px] text-zinc-400">
                  Fecha objetivo: {formatFecha(modalEditar.fechaObjetivo)}. Vacío = sin
                  estimado.
                </p>
              </div>

              <p className="text-[11px] text-zinc-500">
                El proveedor validará sobre estos valores. Editar no reinicia su plazo
                de confirmación ni cambia el estatus.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalEditar(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditar}
                disabled={ejecutando || !(parseFloat(editCantidad) >= 0)}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50"
              >
                {ejecutando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reasignar */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Reasignar proveedor
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {modalReasignar.productoNombre} — actualmente:{" "}
                  {modalReasignar.proveedorNombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReasignar(null)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {modalReasignar.ofertasAlternativas.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No hay otros proveedores que hayan cotizado este material.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600">
                    Selecciona el nuevo proveedor:
                  </p>
                  <div className="space-y-2">
                    {modalReasignar.ofertasAlternativas.map((o: any) => (
                      <label
                        key={o.proveedorId}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          nuevoProveedorId === o.proveedorId
                            ? "border-[var(--color-primario)] bg-[var(--color-primario)]/5"
                            : "border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="proveedor"
                          value={o.proveedorId}
                          checked={nuevoProveedorId === o.proveedorId}
                          onChange={() => setNuevoProveedorId(o.proveedorId)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            {o.proveedorNombre}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatImporte(o.precioUnitario, modalReasignar.moneda ?? "MXN")} · disp:{" "}
                            {o.cantidadDisponible} {modalReasignar.unidadMedida}{" "}
                            · R{o.ronda}
                          </p>
                          {!o.puedeCumplirFecha && o.fechaEstimadaEntrega && (
                            <p className="text-xs text-amber-600">
                              Entrega estimada:{" "}
                              {formatFecha(o.fechaEstimadaEntrega)}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalReasignar(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReasignar}
                disabled={!nuevoProveedorId || ejecutando}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50"
              >
                {ejecutando ? "Reasignando…" : "Confirmar reasignación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cola de correos: RESULTADO_INTERNO → GANADORES → NO_GANADORES ──── */}
      {colaCorreos.length > 0 && (
        <ModalCorreo
          key={colaCorreos[0].key}
          abierto
          onCerrar={avanzarCola}
          onEnviado={avanzarCola}
          tipo={colaCorreos[0].tipo}
          tituloModal={colaCorreos[0].tituloModal}
          codigoCliente={codigoCliente}
          variables={colaCorreos[0].variables}
          destinatarios={colaCorreos[0].destinatarios}
          variablesPorDestinatario={colaCorreos[0].variablesPorDestinatario}
          adjuntos={colaCorreos[0].adjuntos}
          aviso={colaCorreos[0].aviso}
        />
      )}
    </div>
  );
}
