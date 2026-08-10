"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { exigirCompradorSesion } from "@/src/lib/compradorSessionSegura";
import type { ResultadoSeleccion } from "@/src/lib/seleccionPrecioTypes";

// Los tipos viven en seleccionPrecioTypes.ts. Este archivo es "use server" y NO
// debe exportar nada que no sea una función async — ni siquiera tipos.

/**
 * Registro del histórico que el comprador elige como el precio válido de un
 * proveedor en una partida.
 *
 * Existe porque hay errores que el sistema no puede detectar solo: un proveedor
 * cotizó el flete en 1000 pensando en dólares y lo corrigió a 17,448 MXN en la
 * ronda 3. Los 1000 son un precio perfectamente válido (> 0), así que el filtro
 * de ofertaValida no los toca y el mínimo automático los sigue eligiendo. Solo
 * una persona que conoce el contexto puede resolverlo.
 *
 * `ofertaItemId: null` vuelve al mínimo automático.
 */
export async function guardarSeleccionRegistro(
  licitacionItemId: string,
  proveedorId: string,
  ofertaItemId: string | null,
  basePath: string,
  licitacionId: string
): Promise<ResultadoSeleccion> {
  const { usuarioId } = await exigirCompradorSesion();

  // El registro elegido debe ser una puja REAL de ese proveedor en ESA partida.
  // Sin esta comprobación, un id manipulado podría fijar como precio válido la
  // puja de un competidor —o la de otra partida— y ese precio termina en una
  // orden de compra.
  if (ofertaItemId) {
    const oferta = await prisma.ofertaItem.findFirst({
      where: { id: ofertaItemId, licitacionItemId, proveedorId },
      select: { id: true },
    });
    if (!oferta) {
      return {
        ok: false,
        mensaje: "Ese registro no pertenece a este proveedor en esta partida.",
      };
    }
  }

  await prisma.seleccionPrecioComprador.upsert({
    where: { licitacionItemId_proveedorId: { licitacionItemId, proveedorId } },
    create: { licitacionItemId, proveedorId, ofertaItemId, actualizadoPor: usuarioId },
    // Solo se toca `ofertaItemId`: el precio negociado es una decisión aparte y
    // no debe borrarse por reelegir el registro base.
    update: { ofertaItemId, actualizadoPor: usuarioId },
  });

  revalidatePath(`${basePath}/comprador/seleccion-proveedores/${licitacionId}`);
  return { ok: true };
}

/**
 * Ajuste de negociación sobre el precio vigente de ese proveedor en esa partida.
 * `precioNegociado: null` lo descarta y devuelve el precio del registro.
 */
export async function guardarPrecioNegociado(
  licitacionItemId: string,
  proveedorId: string,
  precioNegociado: number | null,
  basePath: string,
  licitacionId: string
): Promise<ResultadoSeleccion> {
  const { usuarioId } = await exigirCompradorSesion();

  // Misma regla que en la captura del proveedor: un precio es un número real y
  // positivo. Un 0 aquí volvería a envenenar los comparativos, justo lo que se
  // eliminó con el cambio de "no dispongo".
  if (precioNegociado !== null) {
    if (!Number.isFinite(precioNegociado) || precioNegociado <= 0) {
      return { ok: false, mensaje: "El precio negociado debe ser mayor que cero." };
    }
  }

  await prisma.seleccionPrecioComprador.upsert({
    where: { licitacionItemId_proveedorId: { licitacionItemId, proveedorId } },
    create: { licitacionItemId, proveedorId, precioNegociado, actualizadoPor: usuarioId },
    // Solo se toca `precioNegociado`: no se pierde el registro elegido.
    update: { precioNegociado, actualizadoPor: usuarioId },
  });

  revalidatePath(`${basePath}/comprador/seleccion-proveedores/${licitacionId}`);
  return { ok: true };
}
