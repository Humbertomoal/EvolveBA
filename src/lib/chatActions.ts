"use server";

import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type MensajeDTO = {
  id: string;
  emisor: "comprador" | "proveedor";
  mensaje: string;
  leido: boolean;
  createdAt: string;
};

export async function getMensajes(
  licitacionId: string,
  proveedorId: string
): Promise<MensajeDTO[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await db.chatMensaje.findMany({
      where: { licitacionId, proveedorId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((m) => ({
      id: m.id,
      emisor: m.emisor as "comprador" | "proveedor",
      mensaje: m.mensaje,
      leido: m.leido,
      createdAt: (m.createdAt as Date).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function enviarMensaje(
  licitacionId: string,
  proveedorId: string,
  emisor: "comprador" | "proveedor",
  mensaje: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = mensaje.trim();
  if (!trimmed) return { ok: false, error: "El mensaje no puede estar vacío." };
  if (trimmed.length > 1000) return { ok: false, error: "Máximo 1000 caracteres." };
  try {
    await db.chatMensaje.create({
      data: { licitacionId, proveedorId, emisor, mensaje: trimmed },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al enviar el mensaje." };
  }
}

export async function marcarLeidos(
  licitacionId: string,
  proveedorId: string,
  emisor: "comprador" | "proveedor"
): Promise<void> {
  try {
    await db.chatMensaje.updateMany({
      where: {
        licitacionId,
        proveedorId,
        emisor: emisor === "comprador" ? "proveedor" : "comprador",
        leido: false,
      },
      data: { leido: true },
    });
  } catch {
    // pre-migration: no-op
  }
}

export async function getMensajesNoLeidos(
  licitacionId: string,
  proveedorId: string,
  emisor: "comprador" | "proveedor"
): Promise<number> {
  try {
    return (await db.chatMensaje.count({
      where: {
        licitacionId,
        proveedorId,
        emisor: emisor === "comprador" ? "proveedor" : "comprador",
        leido: false,
      },
    })) as number;
  } catch {
    return 0;
  }
}

export async function getTotalNoLeidosProveedor(
  proveedorId: string
): Promise<number> {
  try {
    return (await db.chatMensaje.count({
      where: { proveedorId, emisor: "comprador", leido: false },
    })) as number;
  } catch {
    return 0;
  }
}
