"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { exigirProveedorSesion } from "@/src/lib/proveedorSessionSegura";

type OfertaItemInput = {
  licitacionItemId: string;
  precioUnitario: number;
  cantidadDisponible: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
};

/**
 * Registra la oferta del proveedor autenticado para la ronda en curso.
 *
 * ── Por qué ya no recibe `proveedorId` ni `ronda` ──────────────────────────
 * Antes ambos venían del cliente. Como esta es una server action invocable
 * directamente, cualquiera podía llamarla con el id de un competidor y COTIZAR
 * EN SU NOMBRE —o escribir sobre una ronda ya cerrada pasando otro número—.
 * Ahora los dos se resuelven en el servidor:
 *   · proveedorId ← sesión (JWT firmado, ver proveedorSessionSegura.ts)
 *   · ronda       ← licitacion.rondaActual
 *
 * ── Verificaciones de pertenencia ─────────────────────────────────────────
 *   1. La licitación existe, no está eliminada y no es de captura Manual.
 *   2. El proveedor está INVITADO a esa licitación (si no, no puede cotizar
 *      aunque conozca el id).
 *   3. Todos los licitacionItemId pertenecen a ESA licitación (evita escribir
 *      ofertas colgadas de materiales de otra licitación).
 */
export async function enviarOfertaAction(
  licitacionId: string,
  basePath: string,
  items: OfertaItemInput[]
): Promise<void> {
  const { proveedorId } = await exigirProveedorSesion();

  const licitacion = await prisma.licitacion.findFirst({
    where: { id: licitacionId, eliminado: false, modoLicitacion: { not: "Manual" } },
    select: {
      id: true,
      rondaActual: true,
      estado: true,
      proveedoresInvitados: { where: { proveedorId }, select: { id: true } },
      items: { select: { id: true } },
    },
  });

  if (!licitacion) {
    throw new Error("Licitación no encontrada o no admite ofertas.");
  }
  if (licitacion.proveedoresInvitados.length === 0) {
    throw new Error("No estás invitado a esta licitación.");
  }
  if (licitacion.estado !== "En Proceso") {
    throw new Error("La licitación no está abierta a ofertas.");
  }

  const ronda = licitacion.rondaActual;
  if (ronda < 1) {
    throw new Error("La licitación aún no tiene una ronda abierta.");
  }

  const idsValidos = new Set(licitacion.items.map((i) => i.id));
  const ajenos = items.filter((i) => !idsValidos.has(i.licitacionItemId));
  if (ajenos.length > 0) {
    throw new Error("Hay materiales que no pertenecen a esta licitación.");
  }

  for (const item of items) {
    await prisma.ofertaItem.upsert({
      where: {
        licitacionItemId_proveedorId_ronda: {
          licitacionItemId: item.licitacionItemId,
          proveedorId,
          ronda,
        },
      },
      create: {
        licitacionItemId: item.licitacionItemId,
        proveedorId,
        ronda,
        precioUnitario: item.precioUnitario,
        cantidadDisponible: item.cantidadDisponible,
        puedeCumplirFecha: item.puedeCumplirFecha,
        fechaEstimadaEntrega: item.fechaEstimadaEntrega
          ? new Date(item.fechaEstimadaEntrega)
          : null,
      },
      update: {
        precioUnitario: item.precioUnitario,
        cantidadDisponible: item.cantidadDisponible,
        puedeCumplirFecha: item.puedeCumplirFecha,
        fechaEstimadaEntrega: item.fechaEstimadaEntrega
          ? new Date(item.fechaEstimadaEntrega)
          : null,
      },
    });
  }

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}`);
}
