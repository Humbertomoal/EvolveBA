"use server";

import { prisma } from "./prisma";
import { getIdentidadActual } from "./proveedorSessionSegura";
import { EMISOR_SISTEMA } from "./avisosRonda";
import type { AvisoLicitacionPendiente } from "./avisosProveedorTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * "sistema" son los avisos automáticos de cambio de ronda (avisosRonda.ts).
 * No los escribe ninguna persona y nadie responde como sistema.
 */
export type EmisorChat = "comprador" | "proveedor" | "sistema";

export type MensajeDTO = {
  id: string;
  emisor: EmisorChat;
  mensaje: string;
  leido: boolean;
  createdAt: string;
};

/**
 * Filtro de `emisor` para "mensajes dirigidos a MÍ que puedo no haber leído".
 * Es ASIMÉTRICO a propósito:
 *
 *   · Proveedor  → { not: "proveedor" }  ⇒ comprador Y sistema.
 *     Los avisos automáticos de ronda deben encender su badge; son para él.
 *
 *   · Comprador  → "proveedor"           ⇒ EXACTAMENTE lo de antes.
 *     No se le cuentan los del sistema: los dispara su propia operación
 *     (avanzar o cerrar rondas) y le llegarían como notificaciones de sí mismo,
 *     multiplicadas por cada proveedor invitado.
 *
 * Antes esto era `propio === "comprador" ? "proveedor" : "comprador"`. Con solo
 * dos emisores daba igual; en cuanto entra "sistema" el opuesto literal deja de
 * significar "lo ajeno", y el proveedor se habría quedado sin badge.
 */
function emisorAjeno(
  propio: "comprador" | "proveedor"
): { not: string } | string {
  return propio === "proveedor" ? { not: "proveedor" } : "proveedor";
}

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
      emisor: m.emisor as EmisorChat,
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
        emisor: emisorAjeno(actor.emisor),
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
        emisor: emisorAjeno(actor.emisor),
        leido: false,
      },
    })) as number;
  } catch {
    return 0;
  }
}

/**
 * Licitaciones del proveedor con avisos automáticos sin leer, para la banda del
 * portal. UNA entrada por licitación aunque tenga varios avisos acumulados.
 *
 * El estado que se muestra (ronda, cierre) se lee EN VIVO de Licitacion, no del
 * texto del mensaje: si se juntaron los avisos de la ronda 2 y la 3, la banda
 * dice "ronda 3", que es donde de verdad está.
 *
 * Identidad forzada desde la sesión por `resolverActorChat`: a un proveedor se
 * le ignora el argumento y se usa su propio id, así que no puede espiar las
 * novedades de un competidor pasando otro id.
 */
export async function getAvisosRondaPendientes(
  proveedorId: string
): Promise<AvisoLicitacionPendiente[]> {
  const actor = await resolverActorChat(proveedorId, "proveedor");
  if (!actor) return [];

  try {
    // Agrupar en la BASE, no en memoria: colapsa N avisos por licitación a una
    // fila y de paso trae el más reciente para ordenar.
    const grupos = await prisma.chatMensaje.groupBy({
      by: ["licitacionId"],
      where: {
        proveedorId: actor.proveedorId,
        emisor: EMISOR_SISTEMA,
        leido: false,
      },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    if (grupos.length === 0) return [];

    const licitaciones = await prisma.licitacion.findMany({
      where: { id: { in: grupos.map((g) => g.licitacionId) }, eliminado: false },
      select: {
        id: true,
        numero: true,
        rondaActual: true,
        esperandoDecision: true,
        estado: true,
      },
    });
    const porId = new Map(licitaciones.map((l) => [l.id, l]));

    return grupos
      .flatMap((g) => {
        // Una licitación borrada deja sus mensajes huérfanos: se omite en vez de
        // enseñar una banda que lleva a una pantalla que ya no existe.
        const lic = porId.get(g.licitacionId);
        if (!lic) return [];
        return [
          {
            licitacionId: lic.id,
            numero: lic.numero,
            rondaActual: lic.rondaActual,
            esperandoDecision: lic.esperandoDecision,
            estado: lic.estado,
            avisosSinLeer: g._count._all,
            ultimoAvisoIso: (g._max.createdAt ?? new Date()).toISOString(),
          },
        ];
      })
      .sort((a, b) => b.ultimoAvisoIso.localeCompare(a.ultimoAvisoIso));
  } catch {
    return [];
  }
}

/**
 * Marca leídos los avisos automáticos de UNA licitación.
 *
 * Acotado a `emisor: "sistema"` a propósito: entrar a una licitación acusa
 * recibo del aviso de ronda, pero NO de los mensajes reales del comprador, que
 * siguen contando para el badge hasta que se abra el chat. Y acotado a esa
 * licitación: las novedades de las demás siguen en la banda.
 */
export async function marcarAvisosSistemaLeidos(
  licitacionId: string,
  proveedorId: string
): Promise<void> {
  const actor = await resolverActorChat(proveedorId, "proveedor");
  if (!actor) return;
  try {
    await prisma.chatMensaje.updateMany({
      where: {
        licitacionId,
        proveedorId: actor.proveedorId,
        emisor: EMISOR_SISTEMA,
        leido: false,
      },
      data: { leido: true },
    });
  } catch {
    // best-effort: no vale tumbar la pantalla por un acuse de lectura
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
    // Siempre desde la óptica del proveedor (es su badge global del portal), así
    // que cuenta comprador + sistema.
    return (await db.chatMensaje.count({
      where: {
        proveedorId: actor.proveedorId,
        emisor: emisorAjeno("proveedor"),
        leido: false,
      },
    })) as number;
  } catch {
    return 0;
  }
}
