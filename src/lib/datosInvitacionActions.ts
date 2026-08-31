"use server";

import { prisma } from "@/src/lib/prisma";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { getDatosInvitacion } from "@/src/lib/datosInvitacion";
import type { DatosInvitacionLicitacion } from "@/src/lib/datosInvitacionTypes";

/**
 * Payload de invitación pedido DESDE EL CLIENTE, con guarda de propiedad.
 *
 * ── Por qué existe, además de `getDatosInvitacion` ──────────────────────────
 * Dos razones, y ninguna es cosmética:
 *
 * 1. GUARDA. El payload lleva los correos de contacto de los proveedores
 *    invitados. `getDatosInvitacion` no filtra por comprador (es una consulta,
 *    no una acción), así que exponerla tal cual dejaría a cualquier comprador
 *    leer la lista de proveedores de una licitación ajena con solo tener el
 *    id. Aquí se exige ser el dueño o tener `puedeVerTodo`.
 *
 * 2. BAJO DEMANDA. La tabla de lanzamiento muestra N licitaciones y el botón
 *    de notificar se pulsa en una. Precargar el payload de las N en el Server
 *    Component serían N consultas con include pesado (items → producto →
 *    fichas técnicas, proveedores → correos) para tirar N-1 a la basura. Se
 *    pide al pulsar, igual que `prepararAdjuntosInvitacionAction`.
 *
 * Devuelve null tanto si la licitación no existe como si no es del comprador:
 * el cliente no necesita distinguir, y no distinguir evita confirmar la
 * existencia de licitaciones ajenas.
 */
export async function getDatosInvitacionAction(
  licitacionId: string
): Promise<DatosInvitacionLicitacion | null> {
  const { compradorId, puedeVerTodo } = await getCompradorSession();

  if (!puedeVerTodo) {
    const duena = await prisma.licitacion.findFirst({
      where: { id: licitacionId, eliminado: false, compradorId },
      select: { id: true },
    });
    if (!duena) return null;
  }

  return getDatosInvitacion(licitacionId);
}
