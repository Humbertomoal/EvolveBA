// Tipos de la banda de avisos del portal del proveedor. Módulo PURO (0 imports).
//
// Viven aquí y no en chatActions.ts porque ese archivo es "use server", y un
// `export type { X }` ahí se compila mal: Turbopack arma la lista de exports
// antes de que TypeScript borre los tipos y emite una referencia a un símbolo
// inexistente → ReferenceError al evaluar el módulo. Ya nos costó una caída en
// producción. Un "use server" exporta SOLO funciones async.

/**
 * Una licitación con avisos automáticos sin leer. UNA entrada por licitación,
 * por más avisos pendientes que tenga: al proveedor le importa "hay novedad
 * aquí", no cuántas veces se le avisó.
 *
 * `rondaActual`, `esperandoDecision` y `estado` se leen EN VIVO de Licitacion,
 * no del texto del mensaje: si se acumularon avisos de la ronda 2 y la 3, lo
 * que se muestra es el estado de ahora, no el del primer aviso.
 */
export type AvisoLicitacionPendiente = {
  licitacionId: string;
  numero: string;
  rondaActual: number;
  esperandoDecision: boolean;
  estado: string;
  /** Cuántos avisos sin leer se agruparon en esta entrada. */
  avisosSinLeer: number;
  /** ISO del aviso más reciente; ordena la banda. */
  ultimoAvisoIso: string;
};

/**
 * ¿La novedad es un cierre o una ronda nueva?
 *
 * Se decide por el estado vigente de la licitación y no por el mensaje, que no
 * tiene campo de tipo. `esperandoDecision` cubre el cierre de rondas; el estado
 * distinto de "En Proceso" cubre la licitación que además ya se cerró o canceló
 * después del aviso.
 */
export function esAvisoDeCierre(aviso: AvisoLicitacionPendiente): boolean {
  return aviso.esperandoDecision || aviso.estado !== "En Proceso";
}
