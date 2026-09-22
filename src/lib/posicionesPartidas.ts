// ─────────────────────────────────────────────────────────────────────────────
// La ÚNICA sentencia SQL cruda del proyecto. Server-only (no es "use server":
// exporta una función síncrona que devuelve una operación de Prisma).
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Reordenar partidas cambia la `posicion` de TODAS las filas de la licitación, y
// cada fila lleva un valor distinto: con el cliente de Prisma eso son N updates,
// uno por partida. Medido contra esta base (Supabase remota, ~110 ms por
// sentencia), invirtiendo el orden completo:
//
//   20 partidas → updates sueltos 2107 ms · $transaction([...]) 2221 ms
//   50 partidas → updates sueltos 5515 ms · $transaction([...]) FALLA a los 5,3 s
//   50 partidas → esta sentencia única                                    88 ms
//
// Prisma NO manda el arreglo de un $transaction en un solo viaje: manda las
// mismas N sentencias dentro de BEGIN/COMMIT, y a ese lote SÍ le aplica el
// timeout de 5 s, que no se puede subir (la opción `timeout` existe solo para
// las transacciones interactivas). O sea que la vía del cliente reventaba
// alrededor de las 45 partidas tocadas en un guardado. Con una sola sentencia el
// reorden cuesta lo mismo que un update suelto y deja de tener techo.
//
// `LicitacionItem` NO tiene `@updatedAt`, así que aquí no hay ninguna columna de
// auditoría que el SQL crudo deba mantener a mano. Si algún día se agrega, hay
// que actualizarla en este UPDATE.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from ".prisma/client/default";
import { prisma } from "./prisma";

export type PosicionPartida = { id: string; posicion: number };

/**
 * Operación que reescribe la `posicion` de varias partidas de UNA licitación en
 * una sola sentencia. Devuelve `null` si no hay nada que mover — un `VALUES`
 * vacío es un error de sintaxis, así que el call site debe omitirla.
 *
 * Pensada para entrar en el `prisma.$transaction([...])` del guardado, junto con
 * los updates de datos, el createMany y los lotes de ocultar y borrar: así el
 * guardado completo sigue siendo todo-o-nada y un reorden no puede quedar a
 * medias con posiciones repetidas.
 *
 * El `licitacionId` va en el WHERE ADEMÁS del id de cada partida: los ids ya
 * salen de la reconciliación de esta misma licitación, pero así una partida de
 * otra licitación no podría moverse ni por un error de programación futuro.
 *
 * Solo tagged template con parámetros ligados (`Prisma.sql` + `Prisma.join`):
 * nada se concatena como texto y no se usa `$executeRawUnsafe`.
 */
export function sentenciaPosicionesPartidas(
  licitacionId: string,
  posiciones: PosicionPartida[]
) {
  if (posiciones.length === 0) return null;

  const filas = posiciones.map(
    ({ id, posicion }) => Prisma.sql`(${id}::text, ${posicion}::int)`
  );

  return prisma.$executeRaw`
    UPDATE "LicitacionItem" AS li
       SET "posicion" = v."posicion"
      FROM (VALUES ${Prisma.join(filas)}) AS v("id", "posicion")
     WHERE li."id" = v."id"
       AND li."licitacionId" = ${licitacionId}
  `;
}
