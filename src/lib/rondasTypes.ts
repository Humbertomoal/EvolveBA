// Tipos de las acciones de ronda. Módulo PURO (0 imports).
//
// Viven aquí y NO en rondasActions.ts a propósito: ese archivo es "use server",
// y un `export type { X }` ahí se compila mal. La transformación de Turbopack
// arma la lista de exports ANTES de que TypeScript borre los tipos, así que
// emite `ensureServerEntryExports([..., X])` con X ya inexistente → ReferenceError
// al evaluar el módulo, sin error de tipos ni de build. Nos costó una caída en
// producción (el histórico de pujas). Un "use server" exporta SOLO funciones
// async; los tipos van en un módulo aparte como este.

/** Por qué no se pudo cerrar la licitación. */
export type MotivoCierreRondas =
  | "no_encontrada"
  | "ya_cerrada"
  | "estado_invalido"
  | "modo_manual"
  | "sin_iniciar";

export type ResultadoCierreRondas =
  | { ok: true; rondasOmitidas: number }
  | { ok: false; motivo: MotivoCierreRondas; mensaje: string };
