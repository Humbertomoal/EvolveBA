// ─────────────────────────────────────────────────────────────────────────────
// Duración ÚNICA de la sesión de Auth.js y de las cookies de panel.
//
// Módulo HOJA a propósito: no importa nada, así que `auth.ts`, el login, el
// selector de /inicio y `compradorSession.ts` pueden compartir la constante sin
// crear un ciclo de imports (compradorSession → compradorSessionSegura → auth).
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Antes había TRES duraciones distintas para la misma identidad: la sesión JWT
// vivía 30 días (el default de Auth.js, que `session: { strategy: "jwt" }` no
// fijaba explícitamente), las cookies de panel 7 días, y la que escribía el
// selector de /inicio solo 24 h. Esa asimetría era un bug: al morir la cookie
// sin morir la sesión, la app seguía "logueada" pero ya no sabía qué comprador
// eras y caía al literal "default" — un id que no le pertenece a ningún
// Usuario, así que las listas se quedaban en las dos licitaciones huérfanas que
// lo llevan estampado.
//
// El arreglo de fondo es que el ROL ya no dependa de esta cookie (ver
// `compradorSession.ts`); igualar las duraciones evita además que la cookie
// muera antes que la sesión y que el alcance se reinicie solo.
// ─────────────────────────────────────────────────────────────────────────────

/** 30 días, en segundos. */
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 30;
