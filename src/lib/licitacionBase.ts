// ─────────────────────────────────────────────────────────────────────────────
// Carga de la licitación ORIGINAL para prellenar el formulario al duplicar.
// Server-only (usa Prisma); los tipos viven en licitacionBaseTypes.ts, que es
// puro, porque los consume un Client Component.
//
// SOLO LEE. Duplicar no escribe una sola vez sobre la original.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/src/lib/prisma";
import { fechaParaInput } from "@/src/lib/dateUtils";
import { parseTiposCambio } from "@/src/lib/conversionMoneda";
import type { LicitacionBase } from "@/src/lib/licitacionBaseTypes";

/** Fecha → valor de un <input type="date">. Mismo criterio que la pantalla de editar. */
function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

function minutosAValorYUnidad(minutos: number): {
  valor: string;
  unidad: LicitacionBase["duracionUnidad"];
} {
  if (minutos % 1440 === 0) return { valor: String(minutos / 1440), unidad: "dias" };
  if (minutos % 60 === 0) return { valor: String(minutos / 60), unidad: "horas" };
  return { valor: String(minutos), unidad: "minutos" };
}

function parsearArchivosAdjuntos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Datos de la licitación `id` listos para prellenar el formulario de creación,
 * o `null` si no existe o está eliminada.
 *
 * Lo que NO trae, por diseño:
 *   · Las partidas RETIRADAS (`eliminado: true`): su valor es el histórico de
 *     ofertas, que no se copia, así que arrastrarlas a una licitación nueva no
 *     tendría sentido.
 *   · Nada del proceso: ofertas, asignaciones, órdenes, selecciones de precio,
 *     chat ni bitácora. Ni se consultan.
 */
export async function getLicitacionBase(id: string): Promise<LicitacionBase | null> {
  const licitacion = await prisma.licitacion.findFirst({
    where: { id, eliminado: false },
    select: {
      id: true,
      numero: true,
      jerarquia: true,
      tipoLicitacion: true,
      costoObjetivo: true,
      fechaEjecucion: true,
      fechaFinLicitacion: true,
      fechaInicioRangoEntrega: true,
      fechaFinRangoEntrega: true,
      duracionRondaMinutos: true,
      maxRondas: true,
      instrucciones: true,
      archivosAdjuntos: true,
      modoLicitacion: true,
      tiposCambio: true,
      monedaConsolidacion: true,
      items: {
        where: { eliminado: false },
        orderBy: [{ posicion: "asc" }, { id: "asc" }],
        select: {
          productoId: true,
          especificacion: true,
          fechaEntrega: true,
          cantidadSolicitada: true,
          precioObjetivo: true,
          moneda: true,
          producto: { select: { unidadMedida: true } },
        },
      },
      proveedoresInvitados: { select: { proveedorId: true } },
    },
  });

  if (!licitacion) return null;

  const { valor: duracionValor, unidad: duracionUnidad } = minutosAValorYUnidad(
    licitacion.duracionRondaMinutos
  );

  return {
    id: licitacion.id,
    numeroOriginal: licitacion.numero,
    jerarquia: licitacion.jerarquia ?? "",
    tipoLicitacion: licitacion.tipoLicitacion ?? "",
    costoObjetivo:
      licitacion.costoObjetivo !== null ? String(licitacion.costoObjetivo) : "",
    fechaEjecucion: fechaParaInput(licitacion.fechaEjecucion),
    fechaFinLicitacion: fechaParaInput(licitacion.fechaFinLicitacion),
    fechaInicioRangoEntrega: toDateInput(licitacion.fechaInicioRangoEntrega),
    fechaFinRangoEntrega: toDateInput(licitacion.fechaFinRangoEntrega),
    duracionValor,
    duracionUnidad,
    maxRondas: String(licitacion.maxRondas),
    instrucciones: licitacion.instrucciones ?? "",
    archivosAdjuntos: parsearArchivosAdjuntos(licitacion.archivosAdjuntos),
    modoLicitacion: licitacion.modoLicitacion,
    // El orden de este arreglo ES el orden de las partidas: crearLicitacionAction
    // asigna `posicion` por índice, así que la copia conserva el orden original.
    items: licitacion.items.map((item) => ({
      productoId: item.productoId,
      unidadMedida: item.producto.unidadMedida,
      especificacion: item.especificacion ?? "",
      fechaEntrega: toDateInput(item.fechaEntrega),
      cantidadSolicitada: String(item.cantidadSolicitada),
      precioObjetivo: item.precioObjetivo !== null ? String(item.precioObjetivo) : "",
      moneda: item.moneda ?? "MXN",
    })),
    proveedoresInvitados: licitacion.proveedoresInvitados.map((p) => p.proveedorId),
    tiposCambio: parseTiposCambio(licitacion.tiposCambio),
    monedaConsolidacion: licitacion.monedaConsolidacion ?? "MXN",
  };
}
