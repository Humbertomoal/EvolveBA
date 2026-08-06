"use server";

import { prisma } from "./prisma";
import { getIdentidadActual } from "./proveedorSessionSegura";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type MensajeDTO = {
  id: string;
  emisor: "comprador" | "proveedor";
  mensaje: string;
  leido: boolean;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// El chat es COMPARTIDO: el mismo ChatWidget lo montan el comprador y el
// proveedor, y `emisor` decide de qué lado se escribe. Los dos argumentos
// venían del cliente, así que un proveedor podía (a) leer y escribir el chat de
// un competidor pasando su id, y (b) hacerse pasar por el COMPRADOR mandando
// emisor: "comprador".
//
// La frontera de confianza es "¿quien llama es un proveedor?":
//   · Proveedor      → se le FUERZA su propio proveedorId y emisor "proveedor".
//                      Sus argumentos se ignoran por completo.
//   · Comprador/admin → se respetan sus argumentos. Conversar con cualquier
//                      proveedor es su función legítima, y así el modo prueba
//                      de admin sigue comportándose igual que antes.
// ─────────────────────────────────────────────────────────────────────────────

type ActorChat = { proveedorId: string; emisor: "comprador" | "proveedor" };

async function resolverActorChat(
  proveedorIdSolicitado: string,
  emisorSolicitado: "comprador" | "proveedor"
): Promise<ActorChat | null> {
  const identidad = await getIdentidadActual();
  if (!identidad) return null;

  if (identidad.esProveedor) {
    if (!identidad.proveedorPropio) return null;
    return { proveedorId: identidad.proveedorPropio.id, emisor: "proveedor" };
  }
  return { proveedorId: proveedorIdSolicitado, emisor: emisorSolicitado };
}

/** El proveedor solo puede conversar sobre licitaciones a las que fue invitado. */
async function proveedorParticipaEn(
  licitacionId: string,
  proveedorId: string
): Promise<boolean> {
  const count = await prisma.licitacionProveedor.count({
    where: { licitacionId, proveedorId },
  });
  return count > 0;
}

export async function getMensajes(
  licitacionId: string,
  proveedorId: string
): Promise<MensajeDTO[]> {
  // El `emisor` no importa para leer; se pasa "proveedor" solo para reutilizar
  // el resolver, que a un proveedor le sobrescribe el id de todas formas.
  const actor = await resolverActorChat(proveedorId, "proveedor");
  if (!actor) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await db.chatMensaje.findMany({
      where: { licitacionId, proveedorId: actor.proveedorId },
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

  const actor = await resolverActorChat(proveedorId, emisor);
  if (!actor) return { ok: false, error: "No autorizado." };

  // Pertenencia: un proveedor solo escribe en licitaciones donde participa.
  if (actor.emisor === "proveedor") {
    const participa = await proveedorParticipaEn(licitacionId, actor.proveedorId);
    if (!participa) return { ok: false, error: "No autorizado." };
  }

  try {
    await db.chatMensaje.create({
      data: {
        licitacionId,
        proveedorId: actor.proveedorId,
        emisor: actor.emisor,
        mensaje: trimmed,
      },
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
  const actor = await resolverActorChat(proveedorId, emisor);
  if (!actor) return;
  try {
    await db.chatMensaje.updateMany({
      where: {
        licitacionId,
        proveedorId: actor.proveedorId,
        emisor: actor.emisor === "comprador" ? "proveedor" : "comprador",
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
  const actor = await resolverActorChat(proveedorId, emisor);
  if (!actor) return 0;
  try {
    return (await db.chatMensaje.count({
      where: {
        licitacionId,
        proveedorId: actor.proveedorId,
        emisor: actor.emisor === "comprador" ? "proveedor" : "comprador",
        leido: false,
      },
    })) as number;
  } catch {
    return 0;
  }
}

/**
 * Total de mensajes sin leer del proveedor. Lo invoca el sidebar del portal
 * (componente cliente), así que el argumento no es de fiar: si quien llama es
 * un proveedor se usa su propio id. Se conserva el parámetro porque el layout
 * y el comprador también la llaman desde el servidor.
 */
export async function getTotalNoLeidosProveedor(
  proveedorId: string
): Promise<number> {
  const actor = await resolverActorChat(proveedorId, "proveedor");
  if (!actor) return 0;
  try {
    return (await db.chatMensaje.count({
      where: { proveedorId: actor.proveedorId, emisor: "comprador", leido: false },
    })) as number;
  } catch {
    return 0;
  }
}
