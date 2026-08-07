"use server";

import { prisma } from "@/src/lib/prisma";
import { parseTiposCambio, type TiposCambio } from "@/src/lib/conversionMoneda";
import { calcularVariacionesPorGrupo } from "@/src/lib/variacionRonda";
import {
  conMontosMXN,
  construirHojaHistorico,
  nombreArchivoSeguro,
  type FilaHistoricoPuja,
} from "@/src/lib/historicoPujasExcel";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

// El tipo vive en historicoPujasExcel.ts (módulo puro) para que el cliente y el
// servidor compartan una sola definición; se reexporta para no romper los
// imports existentes.
export type { FilaHistoricoPuja };

const LIMITE_FILAS = 500;

async function consultarOfertasHistorico(
  licitacionId: string,
  opciones: { proveedorId?: string; ronda?: number; limite?: number }
): Promise<{ filas: FilaHistoricoPuja[]; total: number; tiposCambio: TiposCambio }> {
  const { proveedorId, ronda, limite } = opciones;

  // Se trae SIEMPRE el histórico completo (todas las rondas) del alcance
  // proveedor-filtrado: la variación ronda-a-ronda de una fila puede
  // depender de una ronda anterior que quedaría fuera si filtráramos por
  // `ronda` directo en la consulta. El filtro de ronda se aplica después,
  // ya con la variación calculada.
  const where = {
    licitacionItem: { licitacionId },
    ...(proveedorId ? { proveedorId } : {}),
  };

  // Las tasas viven en la licitación (congeladas al crearla), no en la oferta.
  // Se cargan aquí y se devuelven junto a las filas para que HistoricoPujas no
  // necesite props nuevas en sus dos call sites.
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { tiposCambio: true },
  });
  const tiposCambio = parseTiposCambio(licitacion?.tiposCambio);

  const ofertas = await prisma.ofertaItem.findMany({
    where,
    include: {
      proveedor: { select: { razonSocial: true } },
      licitacionItem: {
        // `moneda` es la FUENTE DE VERDAD. Antes no se pedía aquí y la fila
        // terminaba usando OfertaItem.moneda (columna muerta, siempre "MXN"),
        // así que un panel cotizado en USD se etiquetaba MXN y jamás se
        // convertía. Ver la nota del schema en LicitacionItem/OfertaItem.
        select: { moneda: true, producto: { select: { nombre: true } } },
      },
    },
    orderBy: [
      { ronda: "asc" },
      { proveedor: { razonSocial: "asc" } },
      { licitacionItem: { producto: { nombre: "asc" } } },
    ],
  });

  const variaciones = calcularVariacionesPorGrupo(
    ofertas,
    (o) => `${o.proveedorId}::${o.licitacionItemId}`
  );

  const filasCompletas: FilaHistoricoPuja[] = ofertas.map((o) => {
    const variacion = variaciones.get(o) ?? null;
    return conMontosMXN(
      {
        ronda: o.ronda,
        proveedorId: o.proveedorId,
        proveedorNombre: o.proveedor.razonSocial,
        productoNombre: o.licitacionItem.producto.nombre,
        cantidadDisponible: o.cantidadDisponible,
        precioUnitario: o.precioUnitario,
        // NO `o.moneda`: esa es la columna muerta. Ver el select de arriba.
        moneda: o.licitacionItem.moneda,
        subtotal: o.cantidadDisponible * o.precioUnitario,
        puedeCumplirFecha: o.puedeCumplirFecha,
        fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
        fechaPuja: o.createdAt.toISOString(),
        variacionMonto: variacion?.diffMonto ?? null,
        variacionPct: variacion?.diffPct ?? null,
      },
      tiposCambio
    );
  });

  const filasFiltradas = ronda
    ? filasCompletas.filter((f) => f.ronda === ronda)
    : filasCompletas;

  const total = filasFiltradas.length;
  const filas = limite ? filasFiltradas.slice(0, limite) : filasFiltradas;

  return { filas, total, tiposCambio };
}

export async function getHistoricoPujas(
  licitacionId: string,
  proveedorId?: string,
  ronda?: number
): Promise<{
  filas: FilaHistoricoPuja[];
  truncado: boolean;
  tiposCambio: TiposCambio;
}> {
  const { filas, total, tiposCambio } = await consultarOfertasHistorico(licitacionId, {
    proveedorId,
    ronda,
    limite: LIMITE_FILAS,
  });
  return { filas, truncado: total > LIMITE_FILAS, tiposCambio };
}

const LIMITE_BYTES_ADJUNTO_EXCEL = 3 * 1024 * 1024; // 3MB, mismo límite prudente que adjuntosCorreoActions.ts

/**
 * Genera el Excel con el detalle completo (todas las rondas/ofertas, sin el
 * tope de 500 filas que usa la vista del histórico) para adjuntarlo al
 * correo RESULTADO_INTERNO. Nunca lanza: si falla la generación o el
 * resultado excede un tamaño prudente, devuelve null (se loguea el motivo)
 * y el llamador debe enviar el correo sin adjunto.
 */
export async function generarExcelHistoricoAdjunto(
  licitacionId: string,
  licitacionNumero: string
): Promise<AdjuntoCorreo | null> {
  try {
    const { filas, tiposCambio } = await consultarOfertasHistorico(licitacionId, {});
    if (filas.length === 0) return null;

    const XLSX = await import("xlsx");
    // Mismas columnas que la descarga del histórico: las dos salen del mismo
    // constructor, así que no pueden volver a divergir. Aquí siempre va la
    // columna Proveedor porque el adjunto cubre a todos.
    const hoja = construirHojaHistorico(XLSX, filas, tiposCambio, {
      incluirProveedor: true,
    });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Histórico");
    const buffer: Buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });

    if (buffer.byteLength > LIMITE_BYTES_ADJUNTO_EXCEL) {
      console.error(
        `Excel de histórico de licitación ${licitacionNumero} excede el límite de adjunto (${buffer.byteLength} bytes) — se omite.`
      );
      return null;
    }

    return {
      nombre: `Licitacion-${nombreArchivoSeguro(licitacionNumero)}_Detalle-Rondas.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contenidoBase64: buffer.toString("base64"),
    };
  } catch (error) {
    console.error(
      `No se pudo generar el Excel de histórico para la licitación ${licitacionNumero}:`,
      error
    );
    return null;
  }
}
