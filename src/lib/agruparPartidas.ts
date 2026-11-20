// ─────────────────────────────────────────────────────────────────────────────
// Grupos de partidas en las LECTURAS (portal del proveedor, comparativo,
// correo de invitación). Módulo PURO: solo un import de tipo, que se borra al
// compilar, así que se puede usar desde Client Components.
//
// ── La regla que sostiene todo ──────────────────────────────────────────────
// Sin grupos, cada lectura se ve EXACTAMENTE como antes: una sola sección, sin
// encabezado. Por eso `hayGrupos` decide si se pinta cualquier encabezado, y
// la sección "Sin grupo" solo lleva encabezado cuando hay otras con grupo.
//
// `agruparPartidas` NO ordena. Corta en secciones las partidas tal como
// llegan, juntando las consecutivas del mismo grupo. Quien lee de la base debe
// pedirlas con ORDEN_PARTIDAS, que deja cada grupo contiguo y "sin grupo" al
// final. Si alguien filtra después (el catálogo del proveedor), el orden
// relativo se conserva y un grupo que se queda sin partidas simplemente no
// produce sección, así que no hay encabezados vacíos.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from ".prisma/client/default";

/** Lo que una lectura necesita de un grupo para mostrarlo. */
export type GrupoLectura = {
  id: string;
  nombre: string;
  domicilio: string | null;
};

/** `select` de Prisma que produce un `GrupoLectura`. */
export const SELECT_GRUPO_LECTURA = {
  select: { id: true, nombre: true, domicilio: true },
} as const;

/**
 * Orden de las partidas en TODAS las lecturas: grupo (por su `orden`; sin
 * grupo al final, porque en ASC Postgres deja los nulos al final), luego
 * posición, luego id como desempate. Mismo criterio que editar/page.tsx y
 * licitacionBase.ts. Sin grupos se reduce a [posicion, id], el orden de antes.
 */
export const ORDEN_PARTIDAS: Prisma.LicitacionItemOrderByWithRelationInput[] = [
  { grupo: { orden: "asc" } },
  { posicion: "asc" },
  { id: "asc" },
];

export type SeccionPartidas<T> = {
  /** null = partidas sin grupo. */
  grupo: GrupoLectura | null;
  /** Índice en el arreglo original de la primera partida de la sección. */
  inicio: number;
  items: T[];
};

export type PartidasAgrupadas<T> = {
  /** false = ninguna partida tiene grupo: se pinta como siempre, sin encabezados. */
  hayGrupos: boolean;
  secciones: SeccionPartidas<T>[];
};

/**
 * Corta en secciones una lista YA ORDENADA. Cada sección es una racha de
 * partidas consecutivas del mismo grupo (o sin grupo).
 */
export function agruparPartidas<T>(
  items: T[],
  grupoDe: (item: T) => GrupoLectura | null | undefined
): PartidasAgrupadas<T> {
  const secciones: SeccionPartidas<T>[] = [];
  let hayGrupos = false;
  items.forEach((item, indice) => {
    const grupo = grupoDe(item) ?? null;
    if (grupo) hayGrupos = true;
    const actual = secciones[secciones.length - 1];
    if (actual && (actual.grupo?.id ?? null) === (grupo?.id ?? null)) {
      actual.items.push(item);
    } else {
      secciones.push({ grupo, inicio: indice, items: [item] });
    }
  });
  return { hayGrupos, secciones };
}

/**
 * Para tablas que pintan por índice (el portal lleva estado por índice de
 * fila): índice de la partida → la sección que EMPIEZA ahí. Vacío si no hay
 * grupos, para que la tabla quede idéntica a la de antes.
 */
export function encabezadosPorIndice<T>(
  agrupadas: PartidasAgrupadas<T>
): Map<number, SeccionPartidas<T>> {
  if (!agrupadas.hayGrupos) return new Map();
  return new Map(agrupadas.secciones.map((s) => [s.inicio, s]));
}

export const ETIQUETA_SIN_GRUPO = "Sin grupo";

/** Domicilio para mostrar, o null si el grupo no tiene o es la sección sin grupo. */
export function domicilioDeGrupo(grupo: GrupoLectura | null): string | null {
  const d = grupo?.domicilio?.trim();
  return d ? d : null;
}
