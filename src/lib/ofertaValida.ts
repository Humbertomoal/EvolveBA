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
export function esCapturaValida(oferta: OfertaEvaluable): boolean {
  // Los dos estados "sin costo" son respuestas completas por sí solas: no
  // llevan precio y no hay nada que validar. Lo que sigue sin ser aceptable es
  // un 0 o un vacío SIN marca, que era la forma implícita —y ambigua— de decir
  // cualquiera de las dos cosas.
  if (oferta.noDisponible) return true;
  if (oferta.noAplica) return true;
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

/** ¿Este estado se guarda con precio 0 y sin cantidad? */
export function estadoSinCosto(estado: EstadoPartida): boolean {
  return estado !== "cotizo";
}
