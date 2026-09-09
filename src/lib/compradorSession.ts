// ─────────────────────────────────────────────────────────────────────────────
// ALCANCE del panel de comprador: "ver todo" vs "solo las mías".
//
// ── Reparto de responsabilidades ───────────────────────────────────────────
// El ROL sale SIEMPRE de la sesión firmada de Auth.js (vía
// `getCompradorSesionSegura`). La cookie `cyrgo_comprador_id` solo puede elegir
// el alcance de un comprador NORMAL; nunca concede privilegios.
//
// Antes no era así: la identidad se leía de la cookie y la evaluación del rol
// vivía detrás de `if (compradorId !== "default")`. Como la cookie duraba 7 días
// y la sesión 30, al caducar la cookie el código entraba con compradorId
// "default", se SALTABA la consulta del rol y devolvía puedeVerTodo=false — un
// ADMINISTRADOR perdía el "ver todo" y las listas se reducían a las dos
// licitaciones huérfanas que llevan compradorId="default" estampado (0010,
// 0016), porque no existe ningún Usuario con ese id.
//
// Y la rama `__todos__` leía el privilegio directamente de la cookie: cualquier
// usuario podía escribir `cyrgo_comprador_id=__todos__` en el navegador y ver
// las licitaciones de todos. Un valor que el cliente controla no puede decidir
// el rol; ahora los admins no necesitan ese centinela y a un no-admin ya no le
// sirve.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { getCompradorSesionSegura } from "./compradorSessionSegura";

export const COMPRADOR_COOKIE = "cyrgo_comprador_id";
export const COMPRADOR_VER_TODO = "__todos__";

/**
 * Valor crudo de la cookie de alcance. NO es una identidad de confianza: el
 * navegador la escribe. Para saber quién opera de verdad, usar
 * `getCompradorSesionSegura`.
 */
export async function getCompradorIdActual(): Promise<string> {
  const store = await cookies();
  return store.get(COMPRADOR_COOKIE)?.value ?? "default";
}

export async function getCompradorSession(): Promise<{
  compradorId: string;
  puedeVerTodo: boolean;
}> {
  const sesion = await getCompradorSesionSegura();

  // Un ADMINISTRADOR o SUPERVISOR ve todo, siempre, sin importar qué diga (o
  // deje de decir) la cookie. Esta comprobación va PRIMERO y sin condiciones
  // previas a propósito: es exactamente la que antes quedaba inalcanzable
  // cuando la cookie era "default" o faltaba.
  if (sesion?.esAdmin || sesion?.esSupervisor) {
    return { compradorId: sesion.usuarioId, puedeVerTodo: true };
  }

  // ── De aquí abajo: comprador NORMAL (o sin sesión interna) ────────────────
  const cookieAlcance = (await cookies()).get(COMPRADOR_COOKIE)?.value;

  // El selector de /inicio sigue funcionando igual para un comprador normal:
  // si eligió a alguien, ese es el alcance. `__todos__` ya no acredita nada, así
  // que se descarta como si no hubiera elección.
  const eligioComprador =
    cookieAlcance !== undefined &&
    cookieAlcance !== "" &&
    cookieAlcance !== "default" &&
    cookieAlcance !== COMPRADOR_VER_TODO;

  // Sin elección, el alcance es la PROPIA identidad autenticada — no el literal
  // "default". Filtrar por "default" no mostraba "lo mío": mostraba las dos
  // huérfanas de otro. Sin sesión interna se queda en "default", que no empata
  // con casi nada: fail-closed (las pantallas de /comprador ya redirigen a
  // login por su cuenta).
  const compradorId = eligioComprador
    ? cookieAlcance
    : sesion?.usuarioId ?? "default";

  return { compradorId, puedeVerTodo: false };
}
