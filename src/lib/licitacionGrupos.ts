// ─────────────────────────────────────────────────────────────────────────────
// Grupos de partidas (proyecto/sitio): validación y plan de guardado.
//
// Módulo PURO — sin Prisma ni "use server" — para que lo usen igual el servidor
// (licitacionesActions.ts) y, si hace falta, el formulario, y para poder
// probarlo aislado. Aquí se DECIDE; escribir es trabajo del action.
//
// Reglas (ver el modelo LicitacionGrupo en schema.prisma):
//   · Si un grupo está oculto, TODAS sus partidas lo están. El guardado se
//     rechaza si el payload la rompe; por eso las lecturas no necesitan un
//     filtro de grupo.
//   · Un grupo vivo necesita al menos una partida viva.
//   · Nombre obligatorio y único entre los grupos vivos de la licitación (sin
//     distinguir mayúsculas ni acentos). Domicilio obligatorio. Coordenadas
//     opcionales: las dos o ninguna, en rango (también hay CHECK en la base).
//   · Quitar un grupo: se OCULTA si después del guardado le sigue apuntando
//     alguna partida (aunque sea oculta: la FK es RESTRICT); si no, se BORRA.
//     Eso solo se sabe con el plan de partidas, así que lo decide
//     `decidirRetiroGrupos`, aparte.
//   · Aviso a proveedores: cambiar domicilio o coordenadas de un grupo con
//     partidas vivas SÍ avisa (cambia el destino y el precio del flete);
//     cambiar solo el nombre o el orden NO.
// ─────────────────────────────────────────────────────────────────────────────

import type { GrupoInput, ItemInput } from "./licitacionInputTypes";

/** Límites de captura. Viven solo en código, como el detalle de producto similar. */
export const MAX_NOMBRE_GRUPO = 120;
export const MAX_DOMICILIO_GRUPO = 500;

export type Coordenadas = { latitud: number; longitud: number };

const NUMERO = /^-?\d+(?:\.\d+)?$/;

/**
 * "20.853501, -104.486565" → { latitud, longitud }. Acepta coma, punto y coma
 * o espacio como separador y paréntesis alrededor (como lo copia Google Maps).
 * "" → null (sin coordenadas).
 */
export function parsearCoordenadas(
  texto: string
): { ok: true; valor: Coordenadas | null } | { ok: false; error: string } {
  const limpio = texto.trim().replace(/^\((.*)\)$/, "$1").trim();
  if (!limpio) return { ok: true, valor: null };

  const partes = limpio.split(/[\s,;]+/).filter(Boolean);
  if (partes.length !== 2 || !partes.every((p) => NUMERO.test(p))) {
    return { ok: false, error: "escríbelas como «latitud, longitud», p. ej. 20.853501, -104.486565" };
  }
  const [latitud, longitud] = partes.map(Number);
  if (latitud < -90 || latitud > 90) {
    return { ok: false, error: "la latitud debe estar entre -90 y 90" };
  }
  if (longitud < -180 || longitud > 180) {
    return { ok: false, error: "la longitud debe estar entre -180 y 180" };
  }
  return { ok: true, valor: { latitud, longitud } };
}

/** Inversa de parsearCoordenadas, para precargar el formulario. */
export function formatearCoordenadas(latitud: number | null, longitud: number | null): string {
  return latitud === null || longitud === null ? "" : `${latitud}, ${longitud}`;
}

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Llave para comparar nombres de grupo: sin acentos, mayúsculas, espacios colapsados. */
export function llaveNombreGrupo(nombre: string): string {
  return nombre.normalize("NFD").replace(DIACRITICOS, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export type GrupoEnBase = {
  id: string;
  nombre: string;
  domicilio: string | null;
  latitud: number | null;
  longitud: number | null;
  orden: number;
  eliminado: boolean;
};

/** A dónde va una partida, resuelto desde su `grupoClave`. */
export type DestinoGrupo =
  | { tipo: "sinGrupo" }
  | { tipo: "existente"; id: string }
  | { tipo: "nuevo"; clave: string };

export type DatosGrupo = {
  nombre: string;
  domicilio: string;
  latitud: number | null;
  longitud: number | null;
};

export type PlanGrupos = {
  /** Motivos por los que el guardado NO puede aplicarse. Vacío = válido. */
  errores: string[];
  /** Destino de cada clave del payload. */
  destinoPorClave: Map<string, DestinoGrupo>;
  /** Grupos nuevos y vivos, con el orden que les toca. */
  aCrear: { clave: string; datos: DatosGrupo; orden: number }[];
  /** Grupos existentes que cambian (datos, orden o se restauran). */
  aActualizar: {
    id: string;
    datos: Partial<DatosGrupo> & { orden?: number; eliminado?: false; eliminadoEn?: null };
  }[];
  /** Grupos existentes y vivos que el payload quita: ocultar o borrar, ver decidirRetiroGrupos. */
  aRetirar: string[];
  /** Grupos existentes cuyo domicilio o coordenadas cambió (candidatos a aviso). */
  destinoCambiado: string[];
};

/** Destino de una partida del payload. null = la clave no existe en el payload. */
export function destinoDeItem(
  item: Pick<ItemInput, "grupoClave">,
  destinoPorClave: Map<string, DestinoGrupo>
): DestinoGrupo | null {
  const clave = item.grupoClave?.trim();
  if (!clave) return { tipo: "sinGrupo" };
  return destinoPorClave.get(clave) ?? null;
}

/**
 * Decide qué hacer con cada grupo, SIN escribir nada, y valida el payload de
 * grupos junto con el grupo de cada partida.
 *
 * `items` son las partidas VÁLIDAS del payload (con producto), en el orden de
 * la pantalla: el número de partida de los mensajes es su índice + 1.
 */
export function planearGrupos(
  gruposEnBase: GrupoEnBase[],
  grupos: GrupoInput[],
  items: Pick<ItemInput, "grupoClave" | "eliminado">[]
): PlanGrupos {
  const errores: string[] = [];
  const porId = new Map(gruposEnBase.map((g) => [g.id, g]));
  const destinoPorClave = new Map<string, DestinoGrupo>();
  const aCrear: PlanGrupos["aCrear"] = [];
  const aActualizar: PlanGrupos["aActualizar"] = [];
  const aRetirar: string[] = [];
  const destinoCambiado: string[] = [];
  const vistos = new Set<string>();
  const eliminadoPorClave = new Map<string, boolean>();
  const nombrePorClave = new Map<string, string>();
  const nombresVivos = new Map<string, string>(); // llave → nombre tal como se capturó

  for (const [indice, g] of grupos.entries()) {
    const clave = g.clave?.trim();
    const etiqueta = g.nombre?.trim() || `el grupo ${indice + 1}`;
    if (!clave) {
      errores.push(`A ${etiqueta} le falta su clave interna. Recarga la página.`);
      continue;
    }
    if (destinoPorClave.has(clave)) {
      errores.push(`Hay dos grupos con la misma clave interna (${etiqueta}). Recarga la página.`);
      continue;
    }

    // Un id que no es de esta licitación (o que otra pestaña ya borró) se trata
    // como grupo NUEVO, igual que las partidas: nunca se escribe sobre un grupo
    // ajeno.
    const enBase = g.id ? porId.get(g.id) : undefined;
    destinoPorClave.set(clave, enBase ? { tipo: "existente", id: enBase.id } : { tipo: "nuevo", clave });
    if (enBase) vistos.add(enBase.id);
    eliminadoPorClave.set(clave, !!g.eliminado);
    nombrePorClave.set(clave, etiqueta);

    if (g.eliminado) {
      // Quitado: si existía vivo, se retira. Un grupo nuevo ya quitado no llega
      // a existir. Uno que ya estaba oculto se queda como está. En ambos casos
      // conserva su LUGAR, igual que una partida tachada: si se movieron grupos
      // alrededor, su orden se actualiza para que la pantalla de editar lo
      // muestre donde el comprador lo dejó (las operaciones de retiro van
      // después en el lote, así que un update previo no estorba).
      if (enBase && indice !== enBase.orden) aActualizar.push({ id: enBase.id, datos: { orden: indice } });
      if (enBase && !enBase.eliminado) aRetirar.push(enBase.id);
      continue;
    }

    // ── Validación de un grupo vivo ──────────────────────────────────────────
    const nombre = g.nombre.trim().replace(/\s+/g, " ");
    const domicilio = g.domicilio.trim();
    if (!nombre) errores.push(`El grupo ${indice + 1} necesita un nombre.`);
    else if (nombre.length > MAX_NOMBRE_GRUPO) {
      errores.push(`El nombre del grupo «${nombre.slice(0, 30)}…» pasa de ${MAX_NOMBRE_GRUPO} caracteres.`);
    }
    if (!domicilio) errores.push(`El grupo «${etiqueta}» necesita un domicilio de entrega.`);
    else if (domicilio.length > MAX_DOMICILIO_GRUPO) {
      errores.push(`El domicilio del grupo «${etiqueta}» pasa de ${MAX_DOMICILIO_GRUPO} caracteres.`);
    }
    const coords = parsearCoordenadas(g.coordenadas ?? "");
    if (!coords.ok) errores.push(`Coordenadas del grupo «${etiqueta}»: ${coords.error}.`);

    if (nombre) {
      const llave = llaveNombreGrupo(nombre);
      const previo = nombresVivos.get(llave);
      if (previo !== undefined) {
        errores.push(`Hay dos grupos llamados «${previo}». Cada grupo necesita un nombre distinto.`);
      } else nombresVivos.set(llave, nombre);
    }

    if (!nombre || !domicilio || !coords.ok) continue;
    const datos: DatosGrupo = {
      nombre,
      domicilio,
      latitud: coords.valor?.latitud ?? null,
      longitud: coords.valor?.longitud ?? null,
    };

    if (!enBase) {
      aCrear.push({ clave, datos, orden: indice });
      continue;
    }

    // Existente: solo se escribe lo que cambió.
    const cambios: PlanGrupos["aActualizar"][number]["datos"] = {};
    if (datos.nombre !== enBase.nombre) cambios.nombre = datos.nombre;
    if (datos.domicilio !== (enBase.domicilio ?? "")) cambios.domicilio = datos.domicilio;
    if (datos.latitud !== enBase.latitud) cambios.latitud = datos.latitud;
    if (datos.longitud !== enBase.longitud) cambios.longitud = datos.longitud;
    if (indice !== enBase.orden) cambios.orden = indice;
    if (enBase.eliminado) {
      cambios.eliminado = false;
      cambios.eliminadoEn = null;
    }
    if (Object.keys(cambios).length > 0) aActualizar.push({ id: enBase.id, datos: cambios });
    if (
      !enBase.eliminado &&
      ("domicilio" in cambios || "latitud" in cambios || "longitud" in cambios)
    ) {
      destinoCambiado.push(enBase.id);
    }
  }

  // Grupos vivos en la base que el payload ya no trae (pestaña vieja): se
  // retiran. Si alguna partida viva les apuntaba, el chequeo de abajo lo detecta
  // (su clave ya no existe) y el guardado se rechaza.
  for (const g of gruposEnBase) {
    if (!vistos.has(g.id) && !g.eliminado) aRetirar.push(g.id);
  }

  // ── Grupo de cada partida ──────────────────────────────────────────────────
  const partidasVivasPorClave = new Map<string, number>();
  for (const [indice, item] of items.entries()) {
    const clave = item.grupoClave?.trim();
    if (!clave) continue;
    if (!destinoPorClave.has(clave)) {
      errores.push(`La partida ${indice + 1} apunta a un grupo que ya no existe. Asígnale un grupo o déjala sin grupo.`);
      continue;
    }
    if (item.eliminado) continue;
    if (eliminadoPorClave.get(clave)) {
      errores.push(
        `La partida ${indice + 1} está en el grupo quitado «${nombrePorClave.get(clave)}». ` +
          `Restaura el grupo o mueve la partida a otro.`
      );
      continue;
    }
    partidasVivasPorClave.set(clave, (partidasVivasPorClave.get(clave) ?? 0) + 1);
  }
  for (const g of grupos) {
    const clave = g.clave?.trim();
    if (!clave || g.eliminado) continue;
    if (!partidasVivasPorClave.get(clave)) {
      errores.push(
        `El grupo «${g.nombre.trim() || "sin nombre"}» no tiene partidas. Agrégale al menos una o quítalo.`
      );
    }
  }

  return { errores, destinoPorClave, aCrear, aActualizar, aRetirar, destinoCambiado };
}

/**
 * De los grupos a retirar, cuáles se OCULTAN y cuáles se BORRAN.
 *
 * Se borra solo si después del guardado ninguna partida le apunta. Las partidas
 * ocultas cuentan (siguen en la base y la FK es RESTRICT); las que este guardado
 * borra o mueve a otro grupo, no.
 *
 * `grupoFinalPorItem`: grupo con el que queda cada partida EXISTENTE tras el
 * guardado (null = sin grupo; cualquier valor distinto del id = se fue).
 * `itemsBorrados`: partidas que este guardado borra de verdad.
 */
export function decidirRetiroGrupos(
  aRetirar: string[],
  itemsEnBase: { id: string; grupoId: string | null }[],
  grupoFinalPorItem: Map<string, string | null>,
  itemsBorrados: Set<string>
): { aOcultar: string[]; aBorrar: string[] } {
  const aOcultar: string[] = [];
  const aBorrar: string[] = [];
  for (const grupoId of aRetirar) {
    const sigueReferenciado = itemsEnBase.some(
      (i) =>
        i.grupoId === grupoId &&
        !itemsBorrados.has(i.id) &&
        (grupoFinalPorItem.has(i.id) ? grupoFinalPorItem.get(i.id) : i.grupoId) === grupoId
    );
    (sigueReferenciado ? aOcultar : aBorrar).push(grupoId);
  }
  return { aOcultar, aBorrar };
}
