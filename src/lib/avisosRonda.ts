// ─────────────────────────────────────────────────────────────────────────────
// Avisos automáticos de cambio de ronda — punto ÚNICO de publicación.
//
// Server-side (importa Prisma). NO es "use server": lo llaman otros módulos de
// servidor, no el cliente.
//
// ── Cómo se evita el duplicado ─────────────────────────────────────────────
// Las transiciones de ronda están repartidas en 7 sitios (licitacionesLogica.ts
// y rondasActions.ts) y varias corren de forma PEREZOSA, en cada carga de
// página. La regla es una sola: cada sitio escribe con compare-and-set
// (updateMany con el estado esperado en el WHERE) y llama aquí SOLO si
// `count === 1`. Postgres resuelve el CAS como un único UPDATE condicional, así
// que de N ejecuciones concurrentes exactamente una gana y exactamente una
// publica.
//
// Este módulo NO deduplica por su cuenta a propósito: si lo hiciera, habría dos
// mecanismos compitiendo y ninguno sería la autoridad.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "./prisma";
import { textoAvisoRonda, type EventoAvisoRonda } from "./plantillasChat";

/** Valor de ChatMensaje.emisor para los avisos automáticos. */
export const EMISOR_SISTEMA = "sistema";

/**
 * Publica el aviso en el chat individual de cada proveedor INVITADO.
 *
 * Destinatarios = LicitacionProveedor (invitados), no solo quienes ya
 * ofertaron: es la misma tabla que autoriza el chat, el hilo existe para todo
 * invitado, y el proveedor que aún no cotiza es justamente al que más se busca
 * empujar.
 *
 * Best-effort: NUNCA lanza. Un fallo al escribir el chat no puede tumbar una
 * transición de ronda ya confirmada en la base — misma convención que
 * `registrarCambioEstado`. Si algo falla se pierde el aviso (no se duplica),
 * que es el modo de fallo preferible.
 */
export async function publicarAvisoRonda(
  licitacionId: string,
  evento: EventoAvisoRonda
): Promise<void> {
  try {
    const invitados = await prisma.licitacionProveedor.findMany({
      where: { licitacionId },
      select: { proveedorId: true },
    });
    if (invitados.length === 0) return;

    const mensaje = textoAvisoRonda(evento);

    // Un solo INSERT con todas las filas: el aviso llega a todos los hilos a la
    // vez, sin N viajes a la base dentro de una transición de ronda.
    await prisma.chatMensaje.createMany({
      data: invitados.map((i) => ({
        licitacionId,
        proveedorId: i.proveedorId,
        emisor: EMISOR_SISTEMA,
        mensaje,
      })),
    });
  } catch (error) {
    console.error(
      "[publicarAvisoRonda] no se pudo publicar el aviso de ronda",
      { licitacionId, evento },
      error
    );
  }
}
