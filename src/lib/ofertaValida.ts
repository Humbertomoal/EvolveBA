// ─────────────────────────────────────────────────────────────────────────────
// Validez de una oferta de partida. Módulo PURO (0 imports).
//
// ── El problema que resuelve ───────────────────────────────────────────────
// Los proveedores usaban el precio 0 para decir "no dispongo de esta partida",
// o lo dejaban vacío (que el formulario convertía en 0 en silencio). Pero 0 es
// matemáticamente el precio más bajo, así que ganaba todos los comparativos:
//
//   · Envenenaba "el precio más eficiente" de ese material.
//   · Hundía el total de la licitación e inflaba el ahorro reportado. En la
//     licitación 0009, un ÚNICO 0 reportaba 83.8 % de ahorro cuando el real
//     era 4.2 % — veinte veces.
//   · Y lo más grave: las ofertas se ordenan por precio ascendente para
//     preseleccionar al ganador en la pantalla de asignación, así que quien
//     dejó la partida en blanco aparecía preseleccionado a $0.
//
// ── La regla ───────────────────────────────────────────────────────────────
// Una oferta compite por "el más barato" solo si es un precio REAL y positivo,
// y si el proveedor no declaró explícitamente que no dispone de la partida.
//
// Doble guarda a propósito: si un call site olvidara el flag, el `> 0` lo
// salva; y al revés. Son dos formas de decir lo mismo y ninguna es redundante
// mientras `precioUnitario` siga siendo NOT NULL (con `noDisponible` el precio
// se guarda en 0, que es justo el valor que el otro filtro atrapa).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma mínima que necesita el filtro. `noDisponible` es OPCIONAL para que el
 * helper funcione con objetos que aún no lo traen (consultas que no lo piden en
 * el select, o el periodo previo a que exista la columna): ausente equivale a
 * `false`, y la guarda de precio sigue aplicando.
 */
export type OfertaEvaluable = {
  precioUnitario: number;
  noDisponible?: boolean | null;
  /**
   * "No aplica": el proveedor SÍ ofrece la partida pero aquí no cobra (da el
   * flete, y la obra está donde él vive). Ver la nota de los dos predicados
   * abajo. Opcional por la misma razón que `noDisponible`: un `select` que no
   * lo pida hace que llegue `undefined`, y eso equivale a `false`.
   */
  noAplica?: boolean | null;
};

/**
 * Lo que necesita la validación de CAPTURA, que es más que lo que necesita el
 * filtro de competencia. Se declara aparte de `OfertaEvaluable` a propósito:
 * así queda escrito en el tipo que la marca de producto similar NO participa en
 * "¿esta oferta compite?" — `esOfertaValida` ni siquiera puede verla.
 */
export type CapturaEvaluable = OfertaEvaluable & {
  /**
   * El proveedor ofrece un producto SIMILAR al solicitado (se pide el 715,
   * ofrece el 720). Marca SOBRE la cotización, no un cuarto estado: la oferta
   * lleva precio y compite con normalidad. Opcional por la misma razón que los
   * otros flags: ausente equivale a `false`.
   */
  esProductoSimilar?: boolean | null;
  /** Qué producto ofrece. Obligatorio si `esProductoSimilar`. */
  productoSimilarDetalle?: string | null;
};

/**
 * Tope del detalle de producto similar.
 *
 * Vive SOLO en código, no en la base: la columna es TEXT sin límite físico. Un
 * texto más largo es un error de captura, no una corrupción de datos, y el
 * lugar de atajarlo es el formulario. De aquí lo toman el `maxLength` del
 * textarea y las dos validaciones, para que no puedan discrepar.
 */
export const LIMITE_DETALLE_SIMILAR = 500;

/** Por qué el detalle de producto similar no es aceptable. */
export type MotivoDetalleSimilar = "vacio" | "muy_largo";

/**
 * Mensajes del detalle inválido. Compartidos por el formulario y el servidor
 * para que el proveedor lea exactamente lo mismo venga de donde venga el
 * rechazo — mismo criterio que el resto de este módulo.
 */
export const MENSAJE_DETALLE_SIMILAR: Record<MotivoDetalleSimilar, string> = {
  vacio: "Describe qué producto ofreces.",
  muy_largo: `La descripción no puede pasar de ${LIMITE_DETALLE_SIMILAR} caracteres.`,
};

/**
 * ¿El detalle de producto similar es aceptable? `null` = sí (o no aplica
 * porque la marca no está puesta).
 *
 * Se mide sobre el texto YA recortado: unos espacios no son una descripción, y
 * tampoco deben consumir el presupuesto de caracteres.
 */
export function validarDetalleSimilar(oferta: {
  esProductoSimilar?: boolean | null;
  productoSimilarDetalle?: string | null;
}): MotivoDetalleSimilar | null {
  if (!oferta.esProductoSimilar) return null;
  const detalle = (oferta.productoSimilarDetalle ?? "").trim();
  if (detalle.length === 0) return "vacio";
  if (detalle.length > LIMITE_DETALLE_SIMILAR) return "muy_largo";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOS predicados, no uno
//
// Durante mucho tiempo bastó `esOfertaValida` porque respondía a la vez dos
// preguntas que siempre daban lo mismo:
//
//   1. ¿esta oferta COMPITE por ganar la partida?
//   2. ¿esta oferta CUENTA para la línea base de mercado?
//
//   precio normal → sí / sí        ·        no dispongo → no / no
//
// "No aplica" es el primer estado donde divergen: SÍ compite (con $0 y puede
// ganar) pero NO entra a la base, porque su cero arrastraría el promedio de lo
// que el mercado sí cobra —y con él, el ahorro medido—. De ahí que ahora haya
// un predicado por pregunta. Antes de agregar un caso especial en algún
// cálculo, pregúntate cuál de las dos está respondiendo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Esta oferta puede competir por "el precio más bajo"? (pregunta 1)
 *
 * El orden de las guardas importa:
 *   · `noDisponible` va PRIMERO y manda. La base tiene un CHECK que impide
 *     tener los dos flags a la vez, pero si alguna fila anómala llegara así,
 *     debe fallar del lado seguro: no compite.
 *   · `noAplica` devuelve true SIN mirar el precio: ese es justo el estado en
 *     el que un 0 es legítimo.
 *   · Un 0 SIN marca sigue cayendo a la última línea y sigue siendo inválido.
 *     Esta línea es la que impide que el bug del precio 0 vuelva: la ÚNICA
 *     forma de que un $0 compita es un `noAplica = true` explícito, y solo hay
 *     un camino de escritura que lo pone (ofertasActions).
 */
export function esOfertaValida(oferta: OfertaEvaluable): boolean {
  if (oferta.noDisponible) return false;
  if (oferta.noAplica) return true;
  return Number.isFinite(oferta.precioUnitario) && oferta.precioUnitario > 0;
}

/**
 * ¿Esta oferta cuenta para la LÍNEA BASE de la partida? (pregunta 2)
 *
 * La base es "cuánto costaba esto antes de negociar", y para eso solo cuentan
 * los que efectivamente cobran. Un "no aplica" queda fuera aunque compita: si
 * entrara, un $0 hundiría el promedio y el ahorro medido se desplomaría justo
 * cuando el negocio dice lo contrario (te ahorraste el concepto entero).
 *
 * Ojo dónde se aplica: en `ahorroPromedio.ts` el filtro corre ANTES de calcular
 * la mediana de referencia. No es un detalle — un $0 dentro de la mediana
 * correría hacia abajo la ventana de outliers [mediana/K, mediana×K] y podría
 * expulsar ofertas bajas perfectamente legítimas.
 */
export function entraALineaBase(oferta: OfertaEvaluable): boolean {
  return esOfertaValida(oferta) && !oferta.noAplica;
}

/** Atajo para el caso más común: quedarse solo con las ofertas que compiten. */
export function soloOfertasValidas<T extends OfertaEvaluable>(ofertas: readonly T[]): T[] {
  return ofertas.filter(esOfertaValida);
}

// ─────────────────────────────────────────────────────────────────────────────
// "La mejor oferta de una partida" — punto ÚNICO de entrada
//
// ── Por qué existen estos dos helpers ──────────────────────────────────────
// El bug del precio 0 tuvo un SEGUNDO brote, y no porque `esOfertaValida`
// estuviera mal: porque es opt-in. Cada pantalla escribía su propio "mínimo"
// —un `orderBy: { precioUnitario: 'asc' }` y tomar `[0]`, un `reduce` con `<`,
// un `Math.min`— y bastaba con que UNA olvidara filtrar para que un proveedor
// que marcó "no dispongo" apareciera como ganador a $0. Se escaparon cuatro.
//
// Estos helpers filtran POR DENTRO, así que quien los use no puede olvidarlo.
// Regla para el futuro: ningún sitio debe volver a calcular el mínimo a mano;
// si necesita la mejor oferta, la pide aquí.
//
// ── El null importa ────────────────────────────────────────────────────────
// Cuando TODAS las ofertas de una partida son inválidas (el caso real: un
// proveedor marcó "no dispongo" en las 5 partidas y era el único que había
// respondido), la respuesta correcta es "esta partida NO tiene ganador", no
// "el ganador vale 0". Por eso se devuelve `null` y cada pantalla decide cómo
// pintar la ausencia ("—", "Sin ganador"). Devolver la primera oferta cruda,
// o un 0, es justo lo que producía el bug.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las ofertas que compiten, de más barata a más cara.
 *
 * Para los sitios que necesitan la lista (rankings, alternativas de
 * reasignación) y no solo la ganadora. El orden es estable: entre dos precios
 * iguales se conserva el orden en que venían, así que el resultado no baila
 * entre renders con los mismos datos.
 */
export function ofertasValidasOrdenadas<T extends OfertaEvaluable>(
  ofertas: readonly T[]
): T[] {
  return soloOfertasValidas(ofertas).sort(
    (a, b) => a.precioUnitario - b.precioUnitario
  );
}

/**
 * La oferta válida más barata de una partida, o `null` si no hay ninguna.
 *
 * `null` NO significa "error": significa que nadie cotizó esa partida de
 * verdad. Quien llame debe pintar la ausencia, nunca un cero.
 *
 * Ante empate gana la primera de la lista recibida, que es determinista para
 * un mismo conjunto de datos.
 */
export function mejorOfertaValida<T extends OfertaEvaluable>(
  ofertas: readonly T[]
): T | null {
  let mejor: T | null = null;
  for (const oferta of ofertas) {
    if (!esOfertaValida(oferta)) continue;
    // `<` estricto y no `<=`: con precios iguales se queda la primera.
    if (mejor === null || oferta.precioUnitario < mejor.precioUnitario) {
      mejor = oferta;
    }
  }
  return mejor;
}

/**
 * ¿Es una CAPTURA aceptable? Regla distinta de `esOfertaValida`, y la
 * diferencia es el punto entero de este cambio:
 *
 *   · esOfertaValida  → ¿compite por "el más barato"?   "no dispongo" = NO.
 *   · esCapturaValida → ¿el proveedor puede enviar esto? "no dispongo" = SÍ.
 *
 * Marcar "no dispongo" es una respuesta legítima y completa; lo que deja de ser
 * aceptable es el precio en 0 o vacío, que era la forma implícita —y ambigua—
 * de decir lo mismo. La usan por igual la validación del formulario y la del
 * servidor, para que no puedan discrepar.
 */
export function esCapturaValida(oferta: CapturaEvaluable): boolean {
  // Los dos estados "sin costo" son respuestas completas por sí solas: no
  // llevan precio y no hay nada que validar. Lo que sigue sin ser aceptable es
  // un 0 o un vacío SIN marca, que era la forma implícita —y ambigua— de decir
  // cualquiera de las dos cosas.
  //
  // Van ANTES que la comprobación del producto similar, y el orden es
  // deliberado: si el proveedor marcó "similar" y después cambió a "no
  // dispongo", la marca es basura que sobró, no un error que deba bloquearlo.
  // Se acepta la captura y `flagsSimilar` la limpia al guardar.
  if (oferta.noDisponible) return true;
  if (oferta.noAplica) return true;
  // Marcar "producto similar" sin decir cuál no es una captura completa: el
  // dato existe justamente para que el comprador sepa qué está comprando.
  if (validarDetalleSimilar(oferta) !== null) return false;
  return Number.isFinite(oferta.precioUnitario) && oferta.precioUnitario > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// El estado de una partida como UN valor
//
// En la base son dos booleanos (fue lo menos invasivo: columna aditiva, sin
// backfill, y un `select` que olvide el flag falla del lado seguro). Pero los
// formularios necesitan lo contrario: un solo valor excluyente que alimente un
// grupo de radios. Estos dos conversores son el puente, y viven aquí para que
// el formulario del proveedor y el de captura manual no inventen cada uno el
// suyo y acaben discrepando.
// ─────────────────────────────────────────────────────────────────────────────

/** Los tres estados posibles de una partida, como valor único y excluyente. */
export type EstadoPartida = "cotizo" | "no_dispongo" | "no_aplica";

/**
 * Flags → estado. `noDisponible` gana si por lo que sea llegaran los dos: es la
 * misma precedencia que aplica `esOfertaValida`, para que la UI y el cálculo no
 * puedan contar historias distintas sobre la misma fila.
 */
export function estadoDePartida(oferta: {
  noDisponible?: boolean | null;
  noAplica?: boolean | null;
}): EstadoPartida {
  if (oferta.noDisponible) return "no_dispongo";
  if (oferta.noAplica) return "no_aplica";
  return "cotizo";
}

/**
 * Estado → flags. Por construcción nunca produce los dos en true, que es lo que
 * el CHECK `oferta_estado_excluyente` de la base exige. Cualquier escritura
 * debería pasar por aquí en vez de armar los booleanos a mano.
 */
export function flagsDeEstado(estado: EstadoPartida): {
  noDisponible: boolean;
  noAplica: boolean;
} {
  return {
    noDisponible: estado === "no_dispongo",
    noAplica: estado === "no_aplica",
  };
}

/**
 * Estado + marca → lo que se guarda de "producto similar".
 *
 * Hermano de `flagsDeEstado`, y por el mismo motivo: que ninguna escritura arme
 * estos campos a mano. Aplica dos reglas de golpe:
 *
 *   · La marca SOLO sobrevive en "cotizo". En los dos estados sin costo se
 *     limpia, igual que el precio se normaliza a 0 — si no, una marca vieja de
 *     otra ronda viajaría pegada a una partida que ya no lleva precio, y el
 *     CHECK `oferta_similar_coherente` rechazaría el INSERT.
 *   · El detalle se guarda recortado, y sin marca se guarda `null` (no cadena
 *     vacía): el dato ausente se representa de una sola forma.
 */
export function flagsSimilar(
  estado: EstadoPartida,
  esProductoSimilar: boolean | null | undefined,
  productoSimilarDetalle: string | null | undefined
): { esProductoSimilar: boolean; productoSimilarDetalle: string | null } {
  if (estado !== "cotizo" || !esProductoSimilar) {
    return { esProductoSimilar: false, productoSimilarDetalle: null };
  }
  return {
    esProductoSimilar: true,
    productoSimilarDetalle: (productoSimilarDetalle ?? "").trim() || null,
  };
}

/**
 * Cuánto puede surtir DE VERDAD el proveedor de una partida.
 *
 * El proveedor registra su propia cantidad (`OfertaItem.cantidadDisponible`)
 * y no tiene por qué coincidir con la solicitada: quien marca "producto
 * similar" suele necesitar OTRA cantidad —un panel de 720 W cubre la misma
 * obra con menos piezas que uno de 715 W—.
 *
 * Es un `min` y no la cantidad del proveedor a secas: si ofrece de más, el
 * comprador no va a comprar el excedente, así que tampoco debe pagarlo en
 * el comparativo. Misma fórmula que ya usan la pantalla de asignación
 * (AsignacionForm) y el total que el propio proveedor ve al cotizar
 * (LicitacionCotizacion) — vive aquí para que las tres no puedan divergir.
 *
 * Multiplicar por la cantidad SOLICITADA infla el total de quien ofrece
 * menos y lo hace parecer más caro de lo que es: castiga justo al que
 * propone la alternativa eficiente.
 */
export function cantidadOfertada(
  cantidadDisponible: number,
  cantidadSolicitada: number
): number {
  return Math.min(cantidadDisponible, cantidadSolicitada);
}

/** ¿Este estado se guarda con precio 0 y sin cantidad? */
export function estadoSinCosto(estado: EstadoPartida): boolean {
  return estado !== "cotizo";
}
