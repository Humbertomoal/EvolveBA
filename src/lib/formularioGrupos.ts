// ─────────────────────────────────────────────────────────────────────────────
// Estado de partidas + grupos del formulario de licitación: transiciones PURAS.
//
// Viven aquí, fuera de LicitacionForm, para poder probarlas (scripts/pruebas/
// grupos.ts) sin montar el formulario.
//
// ── Invariante del arreglo de partidas ─────────────────────────────────────
// `items` está SIEMPRE ordenado por sección: primero las partidas del grupo 1,
// luego las del grupo 2, …, y al final las "sin grupo". Dentro de cada sección,
// en el orden en que el comprador las ve. Es el mismo orden en que las lee el
// servidor (grupo.orden, luego posicion), así que lo que se ve es lo que se
// guarda.
//
// ── Por qué importa `reordena` (el bug de septiembre) ──────────────────────
// La `posicion` es GLOBAL y el servidor solo la recalcula (= índice en el
// arreglo) cuando el payload trae `reordenado: true`; si no, cada partida
// conserva la suya. Mover una partida a otro grupo SIN renumerar la deja con
// su posicion vieja, y al releer se acomoda en otro lugar dentro de su grupo
// nuevo: lo guardado ya no es lo que se veía. Por eso toda transición que
// cambia el orden relativo de las partidas devuelve `reordena: true`, y el
// formulario lo traslada a su bandera `reordenado`.
// ─────────────────────────────────────────────────────────────────────────────

import type { GrupoInput } from "./licitacionInputTypes";

/** Un grupo tal como lo maneja el formulario. */
export type GrupoFila = {
  /** Llave estable; = id si el grupo ya existe en la base. */
  clave: string;
  /** Id real. Ausente = grupo nuevo (o copiado al duplicar). */
  id?: string;
  nombre: string;
  domicilio: string;
  /** Texto "lat, lng" tal como se captura. */
  coordenadas: string;
  /** Quitado, pero con partidas ocultas que lo sostienen: se ve tachado. */
  eliminado?: boolean;
};

/** Lo mínimo que estas transiciones necesitan de una partida. */
export type FilaConGrupo = {
  _id: string;
  grupoClave?: string | null;
  eliminado?: boolean;
  tieneDependencias?: boolean;
};

export type EstadoPartidas<T extends FilaConGrupo> = { items: T[]; grupos: GrupoFila[] };

/** Resultado de una transición. `reordena` = el orden relativo de partidas cambió. */
export type Transicion<T extends FilaConGrupo> = EstadoPartidas<T> & { reordena: boolean };

/** Clave de la sección de una partida: su grupo si existe en la lista, si no null (sin grupo). */
export function seccionDe(item: FilaConGrupo, grupos: GrupoFila[]): string | null {
  const clave = item.grupoClave ?? null;
  return clave !== null && grupos.some((g) => g.clave === clave) ? clave : null;
}

/** Ordena por sección (grupos en su orden, "sin grupo" al final), estable dentro de cada una. */
export function ordenarPorSecciones<T extends FilaConGrupo>(items: T[], grupos: GrupoFila[]): T[] {
  const lugar = new Map(grupos.map((g, i) => [g.clave, i]));
  const sinGrupo = grupos.length;
  return items
    .map((item, i) => ({ item, i, s: lugar.get(seccionDe(item, grupos) ?? "") ?? sinGrupo }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.item);
}

export type Seccion<T> = {
  /** null = "sin grupo". */
  grupo: GrupoFila | null;
  /** Partidas de la sección con su índice GLOBAL en el arreglo. */
  items: { item: T; indice: number }[];
};

/**
 * Secciones para dibujar. Sin grupos: una sola sección null (la tabla de
 * siempre). Con grupos: una por grupo y "sin grupo" solo si tiene partidas.
 */
export function secciones<T extends FilaConGrupo>(items: T[], grupos: GrupoFila[]): Seccion<T>[] {
  const porSeccion = new Map<string | null, { item: T; indice: number }[]>();
  items.forEach((item, indice) => {
    const s = seccionDe(item, grupos);
    porSeccion.set(s, [...(porSeccion.get(s) ?? []), { item, indice }]);
  });
  if (grupos.length === 0) return [{ grupo: null, items: porSeccion.get(null) ?? [] }];
  const resultado: Seccion<T>[] = grupos.map((g) => ({ grupo: g, items: porSeccion.get(g.clave) ?? [] }));
  const sueltas = porSeccion.get(null) ?? [];
  if (sueltas.length > 0) resultado.push({ grupo: null, items: sueltas });
  return resultado;
}

const sinCambio = <T extends FilaConGrupo>(e: EstadoPartidas<T>): Transicion<T> => ({ ...e, reordena: false });

/** Sube/baja una partida intercambiándola con su vecina DENTRO de su sección. */
export function moverPartida<T extends FilaConGrupo>(
  e: EstadoPartidas<T>,
  id: string,
  direccion: -1 | 1
): Transicion<T> {
  const i = e.items.findIndex((x) => x._id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= e.items.length) return sinCambio(e);
  if (seccionDe(e.items[i], e.grupos) !== seccionDe(e.items[j], e.grupos)) return sinCambio(e);
  const items = [...e.items];
  [items[i], items[j]] = [items[j], items[i]];
  return { items, grupos: e.grupos, reordena: true };
}

/** Pasa una partida a otro grupo (o a "sin grupo"): queda AL FINAL de su sección nueva. */
export function moverPartidaAGrupo<T extends FilaConGrupo>(
  e: EstadoPartidas<T>,
  id: string,
  claveDestino: string | null
): Transicion<T> {
  const fila = e.items.find((x) => x._id === id);
  if (!fila) return sinCambio(e);
  const destino = claveDestino !== null && e.grupos.some((g) => g.clave === claveDestino) ? claveDestino : null;
  if (seccionDe(fila, e.grupos) === destino) return sinCambio(e);
  // Se saca y se agrega al final; el orden estable por secciones la deja como
  // última de su grupo nuevo.
  const movida = { ...fila, grupoClave: destino };
  const items = ordenarPorSecciones([...e.items.filter((x) => x._id !== id), movida], e.grupos);
  return { items, grupos: e.grupos, reordena: true };
}

/** Sube/baja un grupo completo. Sus partidas viajan con él. */
export function moverGrupo<T extends FilaConGrupo>(
  e: EstadoPartidas<T>,
  clave: string,
  direccion: -1 | 1
): Transicion<T> {
  const i = e.grupos.findIndex((g) => g.clave === clave);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= e.grupos.length) return sinCambio(e);
  const grupos = [...e.grupos];
  [grupos[i], grupos[j]] = [grupos[j], grupos[i]];
  return { items: ordenarPorSecciones(e.items, grupos), grupos, reordena: true };
}

/** Agrega un grupo vacío al final. No mueve ninguna partida. */
export function agregarGrupo<T extends FilaConGrupo>(e: EstadoPartidas<T>, grupo: GrupoFila): Transicion<T> {
  return { items: e.items, grupos: [...e.grupos, grupo], reordena: false };
}

/**
 * Agrega una partida al final de una sección. NO renumera: sin `reordenado`,
 * el servidor le da max(posicion)+1, que al leer por grupo y luego posición la
 * deja también al final de su grupo. Lo que se ve es lo que se guarda.
 */
export function agregarPartida<T extends FilaConGrupo>(
  e: EstadoPartidas<T>,
  fila: T,
  clave: string | null
): Transicion<T> {
  const nueva = { ...fila, grupoClave: clave };
  return { items: ordenarPorSecciones([...e.items, nueva], e.grupos), grupos: e.grupos, reordena: false };
}

/**
 * Quita un grupo. Cada partida suya sigue la regla de siempre: con
 * dependencias se OCULTA (tachada, restaurable); sin ellas sale de la lista. Si
 * le queda alguna partida oculta, el grupo se queda tachado; si no, sale de la
 * lista.
 */
export function quitarGrupo<T extends FilaConGrupo>(e: EstadoPartidas<T>, clave: string): Transicion<T> {
  if (!e.grupos.some((g) => g.clave === clave)) return sinCambio(e);
  const items: T[] = [];
  let quedanOcultas = false;
  for (const item of e.items) {
    if (seccionDe(item, e.grupos) !== clave) items.push(item);
    else if (item.tieneDependencias) {
      items.push({ ...item, eliminado: true });
      quedanOcultas = true;
    }
  }
  const grupos = quedanOcultas
    ? e.grupos.map((g) => (g.clave === clave ? { ...g, eliminado: true } : g))
    : e.grupos.filter((g) => g.clave !== clave);
  return { items: ordenarPorSecciones(items, grupos), grupos, reordena: true };
}

/** Restaura un grupo quitado y todas sus partidas. */
export function restaurarGrupo<T extends FilaConGrupo>(e: EstadoPartidas<T>, clave: string): Transicion<T> {
  if (!e.grupos.some((g) => g.clave === clave && g.eliminado)) return sinCambio(e);
  const grupos = e.grupos.map((g) => (g.clave === clave ? { ...g, eliminado: false } : g));
  const items = e.items.map((item) =>
    seccionDe(item, e.grupos) === clave ? { ...item, eliminado: false } : item
  );
  return { items, grupos, reordena: true };
}

/**
 * Restaura una partida. Si su grupo estaba quitado, lo restaura también: un
 * grupo oculto no puede tener partidas vivas.
 */
export function restaurarPartida<T extends FilaConGrupo>(e: EstadoPartidas<T>, id: string): Transicion<T> {
  const fila = e.items.find((x) => x._id === id);
  if (!fila) return sinCambio(e);
  const s = seccionDe(fila, e.grupos);
  const items = e.items.map((x) => (x._id === id ? { ...x, eliminado: false } : x));
  const grupos = e.grupos.map((g) => (g.clave === s && g.eliminado ? { ...g, eliminado: false } : g));
  return { items, grupos, reordena: false };
}

/** Grupos para el payload, en el orden de la pantalla. */
export function gruposParaPayload(grupos: GrupoFila[]): GrupoInput[] {
  return grupos.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    clave: g.clave,
    nombre: g.nombre,
    domicilio: g.domicilio,
    coordenadas: g.coordenadas,
    eliminado: g.eliminado ?? false,
  }));
}
