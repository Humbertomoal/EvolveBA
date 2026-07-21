"use server";

import { prisma } from "@/src/lib/prisma";
import { formatFechaMexico } from "@/src/lib/dateUtils";
import { formatImporte } from "@/src/lib/monedas";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

export type FilaHistoricoPuja = {
  ronda: number;
  proveedorId: string;
  proveedorNombre: string;
  productoNombre: string;
  cantidadDisponible: number;
  precioUnitario: number;
  moneda: string;
  subtotal: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
  fechaPuja: string;
};

const LIMITE_FILAS = 500;

async function consultarOfertasHistorico(
  licitacionId: string,
  opciones: { proveedorId?: string; ronda?: number; limite?: number }
): Promise<{ filas: FilaHistoricoPuja[]; total: number }> {
  const { proveedorId, ronda, limite } = opciones;
  const where = {
    licitacionItem: { licitacionId },
    ...(proveedorId ? { proveedorId } : {}),
    ...(ronda ? { ronda } : {}),
  };

  const [total, ofertas] = await Promise.all([
    prisma.ofertaItem.count({ where }),
    prisma.ofertaItem.findMany({
      where,
      include: {
        proveedor: { select: { razonSocial: true } },
        licitacionItem: { select: { producto: { select: { nombre: true } } } },
      },
      orderBy: [
        { ronda: "asc" },
        { proveedor: { razonSocial: "asc" } },
        { licitacionItem: { producto: { nombre: "asc" } } },
      ],
      ...(limite ? { take: limite } : {}),
    }),
  ]);

  const filas: FilaHistoricoPuja[] = ofertas.map((o) => ({
    ronda: o.ronda,
    proveedorId: o.proveedorId,
    proveedorNombre: o.proveedor.razonSocial,
    productoNombre: o.licitacionItem.producto.nombre,
    cantidadDisponible: o.cantidadDisponible,
    precioUnitario: o.precioUnitario,
    moneda: o.moneda,
    subtotal: o.cantidadDisponible * o.precioUnitario,
    puedeCumplirFecha: o.puedeCumplirFecha,
    fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
    fechaPuja: o.createdAt.toISOString(),
  }));

  return { filas, total };
}

export async function getHistoricoPujas(
  licitacionId: string,
  proveedorId?: string,
  ronda?: number
): Promise<{ filas: FilaHistoricoPuja[]; truncado: boolean }> {
  const { filas, total } = await consultarOfertasHistorico(licitacionId, {
    proveedorId,
    ronda,
    limite: LIMITE_FILAS,
  });
  return { filas, truncado: total > LIMITE_FILAS };
}

function nombreArchivoSeguro(texto: string): string {
  return texto.replace(/[^a-zA-Z0-9_-]+/g, "_");
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
    const { filas } = await consultarOfertasHistorico(licitacionId, {});
    if (filas.length === 0) return null;

    const XLSX = await import("xlsx");
    const filasExcel = filas.map((f) => ({
      Ronda: `R${f.ronda}`,
      Proveedor: f.proveedorNombre,
      Material: f.productoNombre,
      "Cantidad ofertada": f.cantidadDisponible,
      "Precio unitario": formatImporte(f.precioUnitario, f.moneda),
      Subtotal: formatImporte(f.subtotal, f.moneda),
      "¿Cumple fecha?": f.puedeCumplirFecha ? "Sí" : "No",
      "Fecha estimada de entrega": formatFechaMexico(f.fechaEstimadaEntrega),
      "Fecha/hora de la puja": formatFechaMexico(f.fechaPuja, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    const hoja = XLSX.utils.json_to_sheet(filasExcel);
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
