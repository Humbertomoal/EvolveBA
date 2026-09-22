"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { parsearFechaMexico } from "@/src/lib/dateUtils";
import { getTiposCambioActuales } from "@/src/lib/getCatalogos";
import { registrarCambioEstado, getUsuarioIdActual } from "@/src/lib/estadoLog";
import { resolverEstado } from "@/src/lib/licitacionesIntencion";
import { exigirCompradorSesion } from "@/src/lib/compradorSessionSegura";
import { publicarAvisoRonda } from "@/src/lib/avisosRonda";
import type { ItemInput, LicitacionInput } from "@/src/lib/licitacionInputTypes";
import {
  sentenciaPosicionesPartidas,
  type PosicionPartida,
} from "@/src/lib/posicionesPartidas";
import { parseTiposCambio } from "@/src/lib/conversionMoneda";
import { copiarArchivo, eliminarArchivo } from "@/src/lib/supabaseStorage";

export type ResultadoGuardarLicitacion = {
  destino: string;
  // Id de la licitación guardada. En creación es el recién asignado — el
  // cliente lo necesita para llamar a `lanzarLicitacionAction` cuando el lote
  // de invitaciones salga completo.
  licitacionId: string;
  // Estado de la licitación ANTES de este guardado. NO decide si se notifica
  // (eso lo decide la intención del botón, y aplicarlo es trabajo de
  // `lanzarLicitacionAction`): sigue aquí solo para el correo de cambio de
  // fecha, que sí depende de si la licitación ya había salido de Borrador.
  estadoPrevio: string;
  // Cuándo salió el lote completo de invitaciones, o null si no hay registro.
  // Informativo para el cliente: quién puede reenviar ya no depende de esto
  // (relanzar re-notifica siempre) y el sello es idempotente del lado del
  // servidor, en `lanzarLicitacionAction`.
  invitacionesEnviadasEn: string | null;
  // fechaEjecucion tal como estaba en la BD antes de este guardado (ISO,
  // instante real) — null si nunca tuvo fecha o es de nueva creación.
  fechaAnteriorISO: string | null;
  // true si fechaEjecucion cambió respecto al valor leído de la BD
  // (comparado ahí mismo, no contra un valor cacheado del cliente).
  fechaCambio: boolean;
};

/**
 * Resultado de guardar. Los fallos ESPERADOS se devuelven, no se lanzan: Next
 * enmascara en producción el mensaje de los errores lanzados dentro de una
 * Server Action (la guía oficial de mutating-data recomienda devolverlos en el
 * estado), así que un `throw` dejaría al comprador con un error genérico en vez
 * del motivo real.
 */
export type ResultadoGuardar =
  | ({ ok: true } & ResultadoGuardarLicitacion)
  | { ok: false; error: string };

const MENSAJE_NUMERO_DUPLICADO =
  "El número de licitación ya existe. Refresca la página e intenta de nuevo con el número que se sugiera.";

/**
 * ¿Es una violación de unicidad de Prisma (P2002) sobre el campo `numero`?
 *
 * Ocurre cuando dos compradores abren el formulario a la vez: ambos reciben la
 * misma sugerencia y el segundo en guardar choca contra la constraint @unique.
 * Se inspecciona sin importar tipos de Prisma para no arrastrar su runtime.
 */
function esNumeroDuplicado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes("numero"));
  return target === undefined || String(target).includes("numero");
}

// `LicitacionInput` e `ItemInput` viven ahora en licitacionInputTypes.ts (ver
// la nota de allí sobre por qué un "use server" no debe exportar tipos).

/** `Licitacion.archivosAdjuntos` es un JSON con lista de URLs, o null. */
function parsearUrlsAdjuntos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

// Normaliza el mapa de tipos de cambio: descarta MXN y tasas no positivas.
// Devuelve null cuando no hay ninguna tasa válida (columna Json? = null).
function sanearTiposCambio(
  tiposCambio: Record<string, number> | undefined
): Record<string, number> | null {
  if (!tiposCambio) return null;
  const out: Record<string, number> = {};
  for (const [moneda, tasa] of Object.entries(tiposCambio)) {
    if (moneda === "MXN") continue;
    if (typeof tasa === "number" && Number.isFinite(tasa) && tasa > 0) {
      out[moneda] = tasa;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Reglas de validación que también se hacen en el cliente, pero se repiten
// aquí por seguridad — un cliente modificado no debe poder saltárselas.
function validarFechas(datos: LicitacionInput) {
  if (
    datos.fechaEjecucion &&
    datos.fechaFinLicitacion &&
    parsearFechaMexico(datos.fechaFinLicitacion)! <=
      parsearFechaMexico(datos.fechaEjecucion)!
  ) {
    throw new Error(
      "La fecha fin de licitación debe ser posterior a la fecha de inicio."
    );
  }
}

/**
 * A dónde mandar al comprador según cómo quedó la licitación. Local (no
 * exportado) porque este archivo es "use server" y solo puede exportar
 * funciones async. Lo comparten `actualizarLicitacionAction` y
 * `lanzarLicitacionAction`: tras el lanzamiento el destino cambia (la
 * licitación pasó a Programada), así que el que se calculó al guardar ya no
 * sirve y hay que recalcularlo aquí.
 */
function destinoParaEstado(
  basePath: string,
  estado: string,
  modoLicitacion: string,
  id: string
): string {
  if (estado === "En Proceso") {
    return modoLicitacion === "Manual"
      ? `${basePath}/comprador/licitaciones-proceso/${id}/captura-manual`
      : `${basePath}/comprador/licitaciones-proceso`;
  }
  if (estado === "Cerrada") return `${basePath}/comprador/seleccion-proveedores`;
  return `${basePath}/comprador/licitaciones/lanzamiento`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Reconciliación incremental de partidas
//
// Sustituye al `deleteMany` + `createMany` que había. Aquel borraba TODAS las
// partidas en cada guardado y las recreaba; funcionaba solo mientras nadie
// hubiera cotizado, porque `OfertaItem_licitacionItemId_fkey` es RESTRICT y
// rechaza el borrado en cuanto existe una oferta. Ese es el error que salió al
// editar la 0016. Ahora también son RESTRICT las FK de AsignacionMaterial y
// SeleccionPrecioComprador (esta última era CASCADE, así que cada guardado se
// llevaba en silencio el borrador de negociación del comprador).
// ─────────────────────────────────────────────────────────────────────────────

/** Estados de la licitación en los que se admite editar. */
const ESTADOS_EDITABLES = new Set(["Borrador", "Programada", "En Proceso"]);

/**
 * Qué cambió en una edición. Ya NO viaja al texto del aviso —el mensaje de
 * chat es fijo (ver `cambioLicitacion`)—: sirve solo para decidir si hay algo
 * que avisar. Local a este archivo por eso mismo.
 */
type CambiosLicitacion = {
  agregadas: number;
  /** Partidas que pasaron a oculta (soft-delete) en este guardado. */
  ocultas: number;
  /** Partidas ocultas que el comprador volvió a poner en juego. */
  restauradas: number;
  /** Partidas cuya cantidad cambió — las que conviene volver a cotizar. */
  cantidadCambiada: number;
  /** Otros cambios de la partida: descripción, fecha de entrega, moneda. */
  modificadas: number;
  fechaCambiada: boolean;
};

type ItemEnBase = {
  id: string;
  productoId: string;
  especificacion: string | null;
  fechaEntrega: Date | null;
  cantidadSolicitada: number;
  precioObjetivo: number | null;
  moneda: string;
  posicion: number;
  eliminado: boolean;
  producto: { nombre: string };
  _count: { ofertas: number; asignaciones: number; seleccionesPrecio: number };
};

/** Valores del payload normalizados a como se guardan, para poder comparar. */
function normalizarItem(item: ItemInput) {
  return {
    productoId: item.productoId,
    especificacion: item.especificacion || null,
    fechaEntrega: item.fechaEntrega ? new Date(item.fechaEntrega) : null,
    cantidadSolicitada: parseFloat(item.cantidadSolicitada) || 0,
    precioObjetivo: item.precioObjetivo ? parseFloat(item.precioObjetivo) : null,
    moneda: item.moneda || "MXN",
  };
}

/** ¿Esta partida tiene algo colgando que impida borrarla o cambiarle el producto? */
function tieneDependencias(fila: ItemEnBase): boolean {
  return (
    fila._count.ofertas > 0 ||
    fila._count.asignaciones > 0 ||
    fila._count.seleccionesPrecio > 0
  );
}

/**
 * Datos de un `update` de partida. NO lleva `posicion`: los cambios de lugar van
 * TODOS por la sentencia única de `sentenciaPosicionesPartidas`, así que ninguna
 * fila se escribe dos veces en el mismo guardado.
 */
type DatosUpdateItem = ReturnType<typeof normalizarItem> & {
  eliminado?: boolean;
  eliminadoEn?: Date | null;
};

type Reconciliacion = {
  /** Partida nueva + la posición que le toca (al final de las que ya hay). */
  aCrear: { item: ItemInput; posicion: number }[];
  aActualizar: { id: string; datos: DatosUpdateItem }[];
  /**
   * Partidas EXISTENTES que cambian de lugar. Van aparte de `aActualizar`
   * porque se aplican en una sola sentencia; vacío cuando no hubo reorden, y
   * entonces el guardado no incluye SQL crudo.
   */
  posiciones: PosicionPartida[];
  /** Partidas a OCULTAR: tienen dependencias, así que no se pueden borrar. */
  aOcultar: string[];
  /** Partidas a borrar de verdad: no las referencia nada. */
  aBorrar: string[];
  /** Motivos por los que el guardado NO puede aplicarse tal cual. */
  bloqueos: string[];
  cambios: CambiosLicitacion;
};

/**
 * Decide qué hacer con cada partida, SIN escribir nada.
 *
 * Separar el cálculo de la escritura es deliberado: si algo está bloqueado, el
 * guardado se rechaza entero y la licitación queda intacta. Un rechazo a medio
 * aplicar sería peor que el bug que estamos arreglando.
 */
function reconciliarItems(
  itemsEnBase: ItemEnBase[],
  itemsPayload: ItemInput[],
  fechaCambiada: boolean,
  /**
   * true = el comprador reordenó: las posiciones se derivan del ÍNDICE en
   * `itemsPayload`, que llega en el orden de la pantalla. false = nadie se
   * movió y cada partida conserva la `posicion` que ya tiene.
   */
  reordenado: boolean
): Reconciliacion {
  const porId = new Map(itemsEnBase.map((i) => [i.id, i]));
  const aCrear: Reconciliacion["aCrear"] = [];
  // Las partidas nuevas se van al FINAL: max de las que ya hay, +1 en adelante.
  // Se calcula con lo ya cargado en memoria (incluidas las ocultas, que siguen
  // ocupando su lugar), sin consultas extra. Sin partidas previas arranca en 0.
  let siguientePosicion =
    itemsEnBase.reduce((max, i) => Math.max(max, i.posicion), -1) + 1;
  const aActualizar: Reconciliacion["aActualizar"] = [];
  const posiciones: PosicionPartida[] = [];
  const aOcultar: string[] = [];
  const bloqueos: string[] = [];
  const cambios: CambiosLicitacion = {
    agregadas: 0,
    ocultas: 0,
    restauradas: 0,
    cantidadCambiada: 0,
    modificadas: 0,
    fechaCambiada,
  };
  const vistos = new Set<string>();

  for (const [indice, item] of itemsPayload.entries()) {
    const fila = item.id ? porId.get(item.id) : undefined;
    // El índice va sobre la lista YA filtrada de filas sin producto, así que una
    // fila vacía a medio capturar no consume un número y las posiciones quedan
    // contiguas. Las retiradas SÍ cuentan: en pantalla siguen ahí, tachadas.
    const posicionDeseada = reordenado ? indice : undefined;

    // Sin id, o con un id que ya no existe (otra pestaña la borró): es nueva.
    // Una fila nueva marcada como oculta no llega a existir: no hay nada que
    // crear ni nada que ocultar.
    if (!fila) {
      if (item.eliminado) continue;
      // Con reorden, el lugar que ocupa en la lista; si no, al final.
      aCrear.push({
        item,
        posicion: posicionDeseada ?? siguientePosicion++,
      });
      cambios.agregadas++;
      continue;
    }
    vistos.add(fila.id);

    // Cambió de lugar: se anota para la sentencia única de posiciones, sin
    // importar qué más le pase a la fila (se oculta, se restaura, se modifica o
    // nada). Así la posición se escribe en un solo sitio.
    if (posicionDeseada !== undefined && posicionDeseada !== fila.posicion) {
      posiciones.push({ id: fila.id, posicion: posicionDeseada });
    }

    // ── Ocultar ────────────────────────────────────────────────────────────
    // El comprador la quitó en pantalla. Como tiene ofertas detrás, no se
    // borra: se oculta. Deja de contar en todo (ver el filtro `eliminado:
    // false` de los consumidores) pero la fila y sus ofertas siguen ahí.
    if (item.eliminado) {
      if (!fila.eliminado) {
        aOcultar.push(fila.id);
        cambios.ocultas++;
      }
      // Ya estaba oculta y sigue oculta: no se toca nada. Si además se movió, su
      // nuevo lugar ya quedó anotado arriba y viaja por la sentencia de
      // posiciones; sus demás datos NO se reescriben.
      continue;
    }

    // ── Restaurar ──────────────────────────────────────────────────────────
    const restaurar = fila.eliminado;
    if (restaurar) cambios.restauradas++;

    const datos = normalizarItem(item);

    // Cambiar el PRODUCTO de una partida con ofertas dejaría los precios ya
    // cotizados colgando de un material distinto del que se coticó. No es una
    // corrección, es una suplantación: se bloquea.
    if (datos.productoId !== fila.productoId && tieneDependencias(fila)) {
      bloqueos.push(
        `“${fila.producto.nombre}” ya tiene ofertas o asignaciones, así que no se le puede cambiar el producto. ` +
          `Agrega una partida nueva con el producto correcto.`
      );
      continue;
    }

    const cantidadCambio = datos.cantidadSolicitada !== fila.cantidadSolicitada;
    const otroCambio =
      datos.productoId !== fila.productoId ||
      datos.especificacion !== fila.especificacion ||
      (datos.fechaEntrega?.getTime() ?? null) !== (fila.fechaEntrega?.getTime() ?? null) ||
      datos.precioObjetivo !== fila.precioObjetivo ||
      datos.moneda !== fila.moneda;

    if (cantidadCambio) cambios.cantidadCambiada++;
    else if (otroCambio) cambios.modificadas++;

    // Se escribe solo si de verdad cambió algo: un guardado que no toca la
    // partida no debe moverle nada (ni disparar avisos). Un cambio de SOLO
    // posición no genera update: va por la sentencia de posiciones. Y tampoco
    // toca los contadores de `cambios`, así que reordenar no dispara el correo
    // ni el chat de ajuste — al proveedor no le cambia nada de lo que cotiza.
    if (restaurar || cantidadCambio || otroCambio) {
      aActualizar.push({
        id: fila.id,
        datos: restaurar ? { ...datos, eliminado: false, eliminadoEn: null } : datos,
      });
    }
  }

  // Lo que estaba en la base y no volvió en el payload. Camino secundario: la
  // UI marca `eliminado` en vez de quitar la fila, así que aquí solo caen las
  // partidas que desaparecieron por otra vía (una pestaña vieja, un cliente
  // manipulado). Se aplica el mismo criterio, para no depender de la UI.
  const aBorrar: string[] = [];
  for (const fila of itemsEnBase) {
    if (vistos.has(fila.id)) continue;
    if (fila.eliminado) continue; // ya estaba oculta: se queda como está
    if (tieneDependencias(fila)) {
      aOcultar.push(fila.id);
      cambios.ocultas++;
      continue;
    }
    // Sin nada que la referencie: borrado real, como siempre.
    aBorrar.push(fila.id);
  }

  return { aCrear, aActualizar, posiciones, aOcultar, aBorrar, bloqueos, cambios };
}

export async function crearLicitacionAction(
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardar> {
  const sesion = await exigirCompradorSesion();
  validarFechas(datos);

  // El DUEÑO sale de la sesión firmada, no de la cookie de alcance. Antes se
  // leía `cyrgo_comprador_id` y, si valía "__todos__" o faltaba, se estampaba el
  // literal "default" — un id que no le pertenece a ningún Usuario. Así nacieron
  // las licitaciones huérfanas 0010 y 0016, que ningún comprador real podía ver.
  const compradorId = sesion.usuarioId;

  // Una licitación que no existe "era" un Borrador: ese es el estadoPrevio con
  // el que se entra a la máquina. Así `preparar_lanzamiento` nace en Borrador
  // (y solo `lanzarLicitacionAction` la promoverá, cuando los correos salgan),
  // e `iniciar_manual` nace En Proceso. Mismo criterio que en la edición: el
  // estado sale de UN solo lugar.
  const nuevaFechaEjecucion = parsearFechaMexico(datos.fechaEjecucion);
  const esFutura = nuevaFechaEjecucion !== null && nuevaFechaEjecucion > new Date();
  const { estado: estadoInicial } = resolverEstado("Borrador", datos.intencion, esFutura);

  const esManualEnProceso =
    datos.modoLicitacion === "Manual" && estadoInicial === "En Proceso";

  // ── DUPLICAR: lo único que se lee de la licitación original ───────────────
  // Sus adjuntos (para copiarlos a Storage) y sus tipos de cambio congelados.
  // Ninguna escritura la toca, y nada del proceso —ofertas, asignaciones,
  // órdenes, selecciones de precio, chat, bitácora— se consulta ni se copia.
  let originalParaDuplicar: {
    archivosAdjuntos: string[];
    tiposCambio: Record<string, number>;
  } | null = null;
  if (datos.baseId) {
    const original = await prisma.licitacion.findFirst({
      where: { id: datos.baseId, eliminado: false },
      select: { archivosAdjuntos: true, tiposCambio: true },
    });
    if (!original) {
      return {
        ok: false,
        error:
          "La licitación que estabas duplicando ya no existe. Recarga la página o empieza en blanco.",
      };
    }
    originalParaDuplicar = {
      archivosAdjuntos: parsearUrlsAdjuntos(original.archivosAdjuntos),
      tiposCambio: parseTiposCambio(original.tiposCambio),
    };
  }

  // Herencia congelada: parte de los tipos de cambio actuales de Settings y los
  // sobrescribe con lo que envió el formulario (override manual del comprador).
  // El resultado queda CONGELADO en la licitación; cambiar Settings después no
  // afecta a esta licitación.
  //
  // Al DUPLICAR la base son los de la ORIGINAL, no los de Settings: la copia
  // debe reproducir la licitación tal como se cotizó. Lo que el comprador vea y
  // edite en el formulario sigue mandando encima.
  const tiposCambioBase =
    originalParaDuplicar?.tiposCambio ?? (await getTiposCambioActuales("default"));
  const tiposCambioCongelado = sanearTiposCambio({
    ...tiposCambioBase,
    ...(datos.tiposCambio ?? {}),
  });

  // Los adjuntos heredados se COPIAN en Storage para que la licitación nueva sea
  // dueña de sus archivos: compartir la URL haría que quitar un adjunto en
  // cualquiera de las dos rompiera a la otra. Todo o nada: si una copia falla,
  // no se crea nada (esto corre ANTES de escribir).
  let archivosAdjuntosFinales = datos.archivosAdjuntos;
  if (originalParaDuplicar) {
    const heredados = new Set(originalParaDuplicar.archivosAdjuntos);
    const copias = new Map<string, string>();
    try {
      for (const url of datos.archivosAdjuntos) {
        if (!heredados.has(url) || copias.has(url)) continue;
        copias.set(url, await copiarArchivo(url));
      }
    } catch (error) {
      await Promise.all(
        [...copias.values()].map((url) => eliminarArchivo(url).catch(() => {}))
      );
      console.error("[crearLicitacion] fallo la copia de adjuntos", error);
      return {
        ok: false,
        error:
          "No se pudieron copiar los archivos adjuntos de la licitación original, " +
          "así que no se creó la licitación nueva. Vuelve a intentar: tus datos " +
          "siguen en pantalla.",
      };
    }
    archivosAdjuntosFinales = datos.archivosAdjuntos.map((u) => copias.get(u) ?? u);
  }

  const itemsValidos = datos.items.filter((item) => item.productoId !== "");

  // Cabecera + partidas + invitados en UNA transacción: o queda la licitación
  // completa, o no queda nada. Antes eran tres escrituras sueltas y un fallo a
  // media tanda dejaba una licitación sin partidas o sin invitados. Es
  // interactiva porque las partidas necesitan el id que asigna el create; son 3
  // sentencias (~300 ms medidos), muy por debajo del timeout de 5 s.
  let licitacion;
  try {
    licitacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.licitacion.create({
        data: {
          numero: datos.numero,
          jerarquia: datos.jerarquia,
          tipoLicitacion: datos.tipoLicitacion,
          costoObjetivo: datos.costoObjetivo,
          fechaEjecucion: nuevaFechaEjecucion,
          fechaFinLicitacion: parsearFechaMexico(datos.fechaFinLicitacion),
          fechaInicioRangoEntrega: datos.fechaInicioRangoEntrega
            ? new Date(datos.fechaInicioRangoEntrega)
            : null,
          fechaFinRangoEntrega: datos.fechaFinRangoEntrega
            ? new Date(datos.fechaFinRangoEntrega)
            : null,
          duracionRondaMinutos: datos.duracionRondaMinutos,
          maxRondas: datos.maxRondas,
          instrucciones: datos.instrucciones,
          archivosAdjuntos:
            archivosAdjuntosFinales.length > 0
              ? JSON.stringify(archivosAdjuntosFinales)
              : null,
          tiposCambio: tiposCambioCongelado ?? undefined,
          monedaConsolidacion: datos.monedaConsolidacion || "MXN",
          estado: estadoInicial,
          modoLicitacion: datos.modoLicitacion,
          compradorId,
          clienteId: "default",
          ...(esManualEnProceso ? { rondaActual: 1, inicioRondaActual: new Date(), fechaInicioLicitacion: new Date() } : {}),
        },
      });

      if (itemsValidos.length > 0) {
        await tx.licitacionItem.createMany({
          // El índice del arreglo ES el orden de captura: el formulario agrega
          // siempre al final y nunca reordena solo. Se deriva aquí en vez de
          // aceptarlo del cliente. Al duplicar, ese orden es el de la original.
          data: itemsValidos.map((item: any, indice: number) => ({
            licitacionId: creada.id,
            posicion: indice,
            productoId: item.productoId,
            especificacion: item.especificacion || null,
            fechaEntrega: item.fechaEntrega ? new Date(item.fechaEntrega) : null,
            cantidadSolicitada: parseFloat(item.cantidadSolicitada) || 0,
            precioObjetivo: item.precioObjetivo
              ? parseFloat(item.precioObjetivo)
              : null,
            moneda: item.moneda || "MXN",
          })),
        });
      }

      // Modo Manual también necesita el registro en LicitacionProveedor: es la
      // lista de invitados que lee captura-manual, aunque no se les notifique.
      if (datos.proveedoresInvitados.length > 0) {
        await tx.licitacionProveedor.createMany({
          data: datos.proveedoresInvitados.map((proveedorId) => ({
            licitacionId: creada.id,
            proveedorId,
          })),
        });
      }

      return creada;
    });
  } catch (error) {
    if (esNumeroDuplicado(error)) {
      return { ok: false, error: MENSAJE_NUMERO_DUPLICADO };
    }
    throw error;
  }

  // Primera entrada de la bitácora: creación (estadoAnterior null). Va FUERA de
  // la transacción: es un registro posterior al hecho y su fallo no debe
  // deshacer una licitación ya creada.
  await registrarCambioEstado(
    licitacion.id,
    null,
    licitacion.estado,
    await getUsuarioIdActual()
  );

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  const destino = esManualEnProceso
    ? `${basePath}/comprador/licitaciones-proceso`
    : `${basePath}/comprador/licitaciones/lanzamiento`;

  // Nueva creación: nunca hubo notificación previa ni fecha anterior.
  return {
    ok: true,
    destino,
    licitacionId: licitacion.id,
    estadoPrevio: "Borrador",
    invitacionesEnviadasEn: null,
    fechaAnteriorISO: null,
    fechaCambio: false,
  };
}

export async function actualizarLicitacionAction(
  id: string,
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardar> {
  const sesion = await exigirCompradorSesion();
  validarFechas(datos);

  // Captura el estado y la fecha ANTES del update — la fuente de verdad es
  // la BD en este momento, no lo que traiga cacheado el cliente.
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      estado: true,
      fechaEjecucion: true,
      invitacionesEnviadasEn: true,
      esperandoDecision: true,
    },
  });
  if (!anterior) return { ok: false, error: "La licitación ya no existe." };

  // ── Guardas de ESTADO y PERMISO ──────────────────────────────────────────
  // Ambas se deciden con el estado LEÍDO DE LA BASE. El cliente no manda
  // estado (se lo quitamos al payload por esto mismo), y aunque lo mandara no
  // se le creería: quien decide si esta edición es de las delicadas es la
  // base, no el formulario.
  if (!ESTADOS_EDITABLES.has(anterior.estado)) {
    return {
      ok: false,
      error: `Una licitación en estado “${anterior.estado}” ya no se puede editar.`,
    };
  }
  if (anterior.esperandoDecision) {
    return {
      ok: false,
      error:
        "Las rondas de esta licitación ya cerraron y está en decisión final. " +
        "Editar sus partidas ahora cambiaría el comparativo sobre el que se está decidiendo.",
    };
  }
  // Editar una licitación YA EN CURSO afecta a proveedores que están cotizando
  // en este momento. Es una atribución de Gerente de Compras o Administrador;
  // un comprador sigue editando con normalidad en Borrador y Programada.
  if (anterior.estado === "En Proceso" && !sesion.esAdmin && !sesion.esSupervisor) {
    return {
      ok: false,
      error:
        "Solo un Gerente de Compras o un Administrador puede editar una licitación En Proceso.",
    };
  }

  const nuevaFechaEjecucion = parsearFechaMexico(datos.fechaEjecucion);
  const esFutura = nuevaFechaEjecucion !== null && nuevaFechaEjecucion > new Date();

  const fechaCambio =
    (anterior.fechaEjecucion?.getTime() ?? null) !==
    (nuevaFechaEjecucion?.getTime() ?? null);
  const estadoPrevio = anterior.estado;

  // El estado sale de la intención del botón + lo que la licitación YA era,
  // resuelto en un solo lugar (licitacionesIntencion.ts). Antes se calculaba
  // aquí con `esFutura ? "Programada" : datos.estado`, y esa inferencia era
  // el bug: promovía borradores a Programada a espaldas del comprador.
  const { estado: estadoFinal, reiniciarRondas } = resolverEstado(
    estadoPrevio,
    datos.intencion,
    esFutura
  );

  // ── Reconciliación de partidas: se CALCULA aquí, antes de escribir nada ──
  // Si algo está bloqueado (una partida con ofertas que el comprador quitó, o
  // un cambio de producto sobre ofertas existentes), el guardado se rechaza
  // ENTERO y la licitación no se toca. Calcular después de haber escrito la
  // cabecera dejaría un guardado a medias.
  const itemsEnBase = await prisma.licitacionItem.findMany({
    where: { licitacionId: id },
    select: {
      id: true,
      productoId: true,
      especificacion: true,
      fechaEntrega: true,
      cantidadSolicitada: true,
      precioObjetivo: true,
      moneda: true,
      // La posición ya cargada aquí es la que conservan las partidas que siguen,
      // y de su máximo salen las posiciones de las nuevas: la reconciliación no
      // necesita ninguna consulta extra.
      posicion: true,
      eliminado: true,
      producto: { select: { nombre: true } },
      _count: { select: { ofertas: true, asignaciones: true, seleccionesPrecio: true } },
    },
  });
  const itemsValidos = datos.items.filter((item) => item.productoId !== "");
  const plan = reconciliarItems(itemsEnBase, itemsValidos, fechaCambio, datos.reordenado);

  if (plan.bloqueos.length > 0) {
    return {
      ok: false,
      error: [
        "No se guardaron los cambios porque hay partidas con ofertas de por medio:",
        ...plan.bloqueos.map((b) => `• ${b}`),
      ].join(" "),
    };
  }

  // Entrar a "En Proceso" marca el inicio real de la licitación. Se sella solo
  // en la TRANSICIÓN: antes bastaba con que el estado enviado fuera "En
  // Proceso", así que cada guardado de una licitación ya arrancada le movía la
  // hora de inicio y falseaba los tiempos por etapa del Tablero.
  const entraAEnProceso = estadoFinal === "En Proceso" && estadoPrevio !== "En Proceso";
  const entraACerrada = estadoFinal === "Cerrada" && estadoPrevio !== "Cerrada";

  try {
    await prisma.licitacion.update({
    where: { id },
    data: {
      numero: datos.numero,
      jerarquia: datos.jerarquia,
      tipoLicitacion: datos.tipoLicitacion,
      costoObjetivo: datos.costoObjetivo,
      fechaEjecucion: nuevaFechaEjecucion,
      fechaFinLicitacion: parsearFechaMexico(datos.fechaFinLicitacion),
      fechaInicioRangoEntrega: datos.fechaInicioRangoEntrega
        ? new Date(datos.fechaInicioRangoEntrega)
        : null,
      fechaFinRangoEntrega: datos.fechaFinRangoEntrega
        ? new Date(datos.fechaFinRangoEntrega)
        : null,
      duracionRondaMinutos: datos.duracionRondaMinutos,
      maxRondas: datos.maxRondas,
      instrucciones: datos.instrucciones,
      archivosAdjuntos:
        datos.archivosAdjuntos.length > 0 ? JSON.stringify(datos.archivosAdjuntos) : null,
      // Solo sobrescribe cuando llegan tasas válidas; si no hay ninguna (todo
      // MXN) se omite y se conserva el valor previo (tasas sin uso son inocuas).
      ...(sanearTiposCambio(datos.tiposCambio)
        ? { tiposCambio: sanearTiposCambio(datos.tiposCambio)! }
        : {}),
      ...(datos.monedaConsolidacion
        ? { monedaConsolidacion: datos.monedaConsolidacion }
        : {}),
      modoLicitacion: datos.modoLicitacion,
      estado: estadoFinal,
      ...(reiniciarRondas
        ? { rondaActual: 0, inicioRondaActual: null, esperandoDecision: false }
        : {}),
      ...(entraAEnProceso ? { fechaInicioLicitacion: new Date() } : {}),
      ...(entraACerrada ? { fechaCerrada: new Date() } : {}),
    },
    });
  } catch (error) {
    if (esNumeroDuplicado(error)) {
      return { ok: false, error: MENSAJE_NUMERO_DUPLICADO };
    }
    throw error;
  }

  // ── Aplicar el plan ──────────────────────────────────────────────────────
  // Actualizar / crear / borrar por separado, conservando el id de las filas
  // que siguen. Ese id es lo que mantiene vivas las ofertas ya recibidas: con
  // el borrar-y-recrear anterior, cada guardado les cambiaba la fila debajo.
  // UN SOLO $transaction en forma de ARREGLO, en el orden en que se le pasan:
  // el guardado de partidas es todo-o-nada. Antes eran `await` sueltos y un
  // reorden interrumpido a medias dejaba posiciones repetidas.
  //
  // Son 4 o 5 sentencias, no una por partida: TODAS las posiciones caben en la
  // primera (ver posicionesPartidas.ts, con la medición que lo justifica). Eso
  // importa porque al lote le aplica el timeout de 5 s de Prisma, que no se
  // puede subir: con un update por partida, un reorden de 50 reventaba.
  //
  // La cabecera (licitacion.update) queda FUERA a propósito: ya se escribió
  // arriba con su propio manejo de número duplicado.
  const sentenciaPosiciones = sentenciaPosicionesPartidas(id, plan.posiciones);
  const operaciones = [
    // Primero las posiciones, en una sola sentencia. Ausente si nadie se movió.
    ...(sentenciaPosiciones ? [sentenciaPosiciones] : []),
    ...plan.aActualizar.map(({ id: itemId, datos: cambiosItem }) =>
      prisma.licitacionItem.update({ where: { id: itemId }, data: cambiosItem })
    ),
    ...(plan.aCrear.length > 0
      ? [
          prisma.licitacionItem.createMany({
            data: plan.aCrear.map(({ item, posicion }) => ({
              licitacionId: id,
              posicion,
              ...normalizarItem(item),
            })),
          }),
        ]
      : []),
    ...(plan.aOcultar.length > 0
      ? [
          // Soft-delete: la partida deja de contar en TODOS los cálculos (cada
          // consulta filtra `eliminado: false`) pero conserva sus ofertas y el
          // histórico, y se puede restaurar. Es lo que P0 rechazaba con un mensaje.
          prisma.licitacionItem.updateMany({
            where: { id: { in: plan.aOcultar } },
            data: { eliminado: true, eliminadoEn: new Date() },
          }),
        ]
      : []),
    ...(plan.aBorrar.length > 0
      ? [
          // Solo llegan aquí las partidas sin ofertas, asignaciones ni borrador
          // de precio: las tres FK son RESTRICT, así que un borrado indebido
          // fallaría.
          prisma.licitacionItem.deleteMany({ where: { id: { in: plan.aBorrar } } }),
        ]
      : []),
  ];

  if (operaciones.length > 0) {
    try {
      await prisma.$transaction(operaciones);
    } catch (error) {
      // El lote es todo-o-nada, así que las partidas quedaron como estaban. Se
      // DEVUELVE el fallo en vez de lanzarlo para que el formulario conserve lo
      // capturado —incluido el reorden— y el comprador pueda reintentar.
      console.error("[actualizarLicitacion] fallo el lote de partidas", error);
      return {
        ok: false,
        error:
          "No se pudieron guardar las partidas, así que quedaron como estaban " +
          "(no hay nada a medias). Los datos generales sí se guardaron. " +
          "Revisa tu conexión y vuelve a intentar: tus cambios siguen en pantalla.",
      };
    }
  }

  await prisma.licitacionProveedor.deleteMany({ where: { licitacionId: id } });
  // Modo Manual también necesita el registro en LicitacionProveedor: es la
  // lista de invitados que lee captura-manual, aunque no se les notifique.
  if (datos.proveedoresInvitados.length > 0) {
    await prisma.licitacionProveedor.createMany({
      data: datos.proveedoresInvitados.map((proveedorId) => ({
        licitacionId: id,
        proveedorId,
      })),
    });
  }

  // Registra el cambio de estado si lo hubo (el helper ignora anterior===nuevo).
  await registrarCambioEstado(
    id,
    estadoPrevio,
    estadoFinal,
    await getUsuarioIdActual()
  );

  // ── Aviso a los proveedores ──────────────────────────────────────────────
  // Solo si la licitación YA ESTABA en curso: en Borrador o Programada nadie
  // está cotizando todavía, y el correo de invitación ya lleva el contenido
  // final. Modo Manual no tiene proveedores en el portal a quienes avisar.
  //
  // Va DESPUÉS de escribir: el aviso describe algo ya ocurrido. Y es
  // best-effort por dentro (publicarAvisoRonda nunca lanza), así que un fallo
  // del chat no puede tumbar una edición ya confirmada en la base.
  const huboCambioAvisable =
    plan.cambios.agregadas > 0 ||
    plan.cambios.ocultas > 0 ||
    plan.cambios.restauradas > 0 ||
    plan.cambios.cantidadCambiada > 0 ||
    plan.cambios.modificadas > 0 ||
    plan.cambios.fechaCambiada;
  if (estadoPrevio === "En Proceso" && datos.modoLicitacion !== "Manual" && huboCambioAvisable) {
    await publicarAvisoRonda(id, { tipo: "cambio_licitacion" });
  }

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  const destino = destinoParaEstado(basePath, estadoFinal, datos.modoLicitacion, id);

  return {
    ok: true,
    destino,
    licitacionId: id,
    estadoPrevio,
    // Se devuelve el valor LEÍDO ANTES del update. Este action nunca lo
    // escribe: sellarlo es trabajo de `lanzarLicitacionAction`, que corre
    // cuando los correos de verdad salieron.
    invitacionesEnviadasEn: anterior?.invitacionesEnviadasEn?.toISOString() ?? null,
    fechaAnteriorISO: anterior?.fechaEjecucion?.toISOString() ?? null,
    fechaCambio,
  };
}

/**
 * Resultado de aplicar el lanzamiento. Como en el guardado, los fallos
 * ESPERADOS se devuelven en vez de lanzarse: Next enmascara en producción el
 * mensaje de un error lanzado dentro de una Server Action, y aquí el mensaje
 * importa muchísimo — los correos YA SALIERON y el comprador tiene que
 * entender que lo único pendiente es reintentar el lanzamiento.
 */
export type ResultadoLanzar =
  | {
      ok: true;
      /** A dónde navegar, recalculado DESPUÉS de la promoción. */
      destino: string;
      /** Estado con el que quedó la licitación. */
      estado: string;
      /** true si esta llamada fue la que movió Borrador → Programada. */
      promovida: boolean;
    }
  | { ok: false; error: string };

const ERROR_LANZAMIENTO =
  "Los correos de invitación SÍ se enviaron, pero no se pudo aplicar el " +
  "lanzamiento de la licitación. Vuelve a intentarlo — no se reenviarán los " +
  "correos.";

/**
 * Aplica el lanzamiento: "los correos salieron, ahora sí muévela".
 *
 * ── Por qué existe (y por qué el guardado ya no promueve) ───────────────────
 * Cambiar el estado y notificar a los proveedores tienen que ser ATÓMICOS.
 * Antes no lo eran: `actualizarLicitacionAction` escribía "Programada" y
 * RECIÉN DESPUÉS el cliente abría el modal de correo. Si el comprador le daba
 * cancelar, la licitación quedaba lanzada sin que nadie hubiera sido invitado
 * — y si la fecha ya había pasado, la siguiente carga de página la arrancaba
 * sola (`verificarYActualizarEstado`), con ronda 1 y aviso publicado, para
 * proveedores que nunca recibieron la invitación.
 *
 * Ahora el guardado deja la licitación como estaba (ver `resolverEstado`,
 * intención "preparar_lanzamiento") y TODO el lanzamiento ocurre aquí, en una
 * transacción, disparado por el `onEnviado` del modal — que ModalCorreo solo
 * llama si el lote COMPLETO de correos salió bien. Cancelar el modal no llega
 * nunca a esta función, así que cancelar no cambia nada: es el no-op que
 * debía ser desde el principio.
 *
 * ── Qué hace exactamente ────────────────────────────────────────────────────
 * 1. Promueve, y SOLO desde "Borrador". Un relanzamiento (editar algo ya
 *    Programada o En Proceso y volver a notificar) reenvía los correos pero NO
 *    toca el estado: la licitación ya está donde debe.
 * 2. Sella `invitacionesEnviadasEn` solo si estaba en null, así que un
 *    relanzamiento conserva la fecha del envío original en vez de pisarla.
 * 3. Registra la transición en bitácora, solo si de verdad hubo movimiento.
 *
 * Los tres pasos van en UNA transacción. Es deliberado que la bitácora entre
 * aquí y no por `registrarCambioEstado` (que es best-effort con el cliente
 * global): esa bitácora alimenta los tiempos por etapa del Tablero, y un
 * lanzamiento sin su entrada correspondiente es justo el tipo de agujero que
 * falsea los KPIs. Si falla el log, se cae todo y el comprador reintenta.
 *
 * Idempotente: reintentarlo tras un fallo de red no duplica nada. La promoción
 * es un compare-and-set (`where: { estado: "Borrador" }`) y el sello exige
 * `invitacionesEnviadasEn: null`, así que la segunda pasada encuentra el
 * trabajo hecho y devuelve `promovida: false` sin escribir. Eso es lo que
 * permite ofrecer un botón "Reintentar" sin reenviar correos.
 */
export async function lanzarLicitacionAction(
  id: string,
  basePath: string
): Promise<ResultadoLanzar> {
  await exigirCompradorSesion();
  const usuarioId = await getUsuarioIdActual();

  // La lectura va FUERA de la transacción a propósito. No es la que garantiza
  // la corrección — de eso se encarga el compare-and-set de abajo, que lleva el
  // estado en el WHERE — y meterla dentro solo alargaba la transacción. Con la
  // base en Supabase (remota) cada ida y vuelta cuesta ~2 s, y las cuatro
  // sentencias juntas se pasaban del timeout de 5 s que Prisma aplica por
  // defecto a las transacciones interactivas: el lanzamiento fallaba con P2028
  // DESPUÉS de que los correos ya habían salido. Observado en pruebas: 7181 ms.
  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, modoLicitacion: true },
  });
  if (!lic) return { ok: false, error: "La licitación ya no existe." };

  let resultado: { estado: string; promovida: boolean; modoLicitacion: string };
  try {
    resultado = await prisma.$transaction(
      async (tx) => {
        // 1) Promoción. Compare-and-set: el estado va en el WHERE, así que dos
        //    pestañas enviando a la vez no promueven dos veces (solo una
        //    obtiene count === 1) y no se duplica la entrada de bitácora. Por
        //    eso da igual que `lic.estado` se haya leído fuera: si cambió
        //    entretanto, el UPDATE no encuentra fila y no se promueve.
        let promovida = false;
        if (lic.estado === "Borrador") {
          const r = await tx.licitacion.updateMany({
            where: { id, estado: "Borrador" },
            data: { estado: "Programada" },
          });
          promovida = r.count === 1;
        }

        // 2) Sello del envío. Solo la primera vez (ver el `where`): un
        //    relanzamiento no pisa la fecha del envío original.
        await tx.licitacion.updateMany({
          where: { id, invitacionesEnviadasEn: null },
          data: { invitacionesEnviadasEn: new Date() },
        });

        // 3) Bitácora, en la misma transacción que la promoción.
        if (promovida) {
          await tx.licitacionEstadoLog.create({
            data: {
              licitacionId: id,
              estadoAnterior: "Borrador",
              estadoNuevo: "Programada",
              usuarioId: usuarioId ?? null,
            },
          });
        }

        return {
          estado: promovida ? "Programada" : lic.estado,
          promovida,
          modoLicitacion: lic.modoLicitacion,
        };
      },
      // Margen amplio sobre el default de 5 s: son hasta 3 sentencias contra
      // una base remota. Este bloque no debe fallar por reloj — cuando falla,
      // los correos ya salieron y la licitación queda a medio lanzar.
      { timeout: 20000, maxWait: 10000 }
    );
  } catch (error) {
    console.error("[lanzarLicitacion] no se pudo aplicar el lanzamiento", { id }, error);
    return { ok: false, error: ERROR_LANZAMIENTO };
  }

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  return {
    ok: true,
    destino: destinoParaEstado(basePath, resultado.estado, resultado.modoLicitacion, id),
    estado: resultado.estado,
    promovida: resultado.promovida,
  };
}

export async function eliminarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await exigirCompradorSesion();
  await prisma.licitacion.update({
    where: { id },
    data: { eliminado: true, eliminadoEn: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}
