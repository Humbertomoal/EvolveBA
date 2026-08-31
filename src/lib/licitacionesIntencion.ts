// ─────────────────────────────────────────────────────────────────────────────
// Qué quiso hacer el comprador al guardar, y qué estado le corresponde.
//
// Módulo PURO (0 imports): lo usa el servidor al guardar y el cliente para
// tipar los botones. NO puede vivir en licitacionesActions.ts porque ese
// archivo es "use server" y un "use server" exporta SOLO funciones async.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El estado lo decidía el SERVIDOR por inferencia:
//
//     estado: esFutura ? "Programada" : datos.estado
//
// Es decir: cualquier guardado con fecha de inicio futura promovía la
// licitación a "Programada", sin importar qué botón se hubiera apretado. Como
// el disparo del correo de invitación se decidía con
// `estadoPrevio === "Borrador" && estado === "Programada"`, un simple "Guardar
// como Borrador" con la fecha ya puesta consumía el único disparo en silencio:
// el servidor escribía "Programada", el cliente creía haber guardado un
// borrador y nunca abría el modal de correo. Le pasó a la licitación 0016 —
// se lanzó sin que ningún proveedor recibiera invitación, sin ningún error.
//
// La cura es que la INTENCIÓN viaje explícita desde el botón y que el estado
// resultante salga de un solo lugar: esta función. El servidor ya no adivina.
// ─────────────────────────────────────────────────────────────────────────────

/** Qué botón se apretó. Cada uno es una intención distinta, no un matiz. */
export type IntencionGuardado =
  /** "Guardar como Borrador" — trabajo en curso. NUNCA promueve ni notifica. */
  | "guardar_borrador"
  /**
   * "Guardar y Notificar Participantes" — el PASO 1 del lanzamiento: guarda el
   * contenido y NADA MÁS. NO promueve. La promoción a "Programada" es el paso
   * 2 y vive fuera de esta función, en `lanzarLicitacionAction`, que corre
   * cuando los correos de verdad salieron. Ver la nota de atomicidad abajo.
   */
  | "preparar_lanzamiento"
  /** "Guardar Cambios" — conserva el estado; no es un lanzamiento. */
  | "editar"
  /** "Iniciar Cotización Manual" — arranca ya, sin proveedores en portal. */
  | "iniciar_manual";

export type EstadoResuelto = {
  /** Estado que debe quedar escrito en la licitación. */
  estado: string;
  /**
   * true cuando la licitación vuelve de "En Proceso" a "Programada": las
   * rondas ya corridas dejan de tener sentido y hay que devolverla a la
   * línea de salida (rondaActual 0, sin inicio de ronda, sin decisión).
   */
  reiniciarRondas: boolean;
};

const BORRADOR = "Borrador";
const PROGRAMADA = "Programada";
const EN_PROCESO = "En Proceso";

/**
 * Estado que corresponde a un guardado, a partir de lo que la licitación ERA
 * (leído de la base, no del cliente) y de lo que el comprador pidió hacer.
 *
 * `fechaEsFutura` solo se consulta en el ÚNICO caso donde la fecha manda de
 * verdad: revertir una licitación ya arrancada. Fuera de ahí la fecha no
 * decide estados — ese era el bug.
 *
 * Estados desconocidos ("Cerrada", "Finalizada", "Cancelada"…) se conservan
 * tal cual bajo "editar": esta función no es la autoridad sobre el ciclo de
 * vida completo, solo sobre el tramo borrador → programada → en proceso.
 */
export function resolverEstado(
  estadoPrevio: string,
  intencion: IntencionGuardado,
  fechaEsFutura: boolean
): EstadoResuelto {
  const estado = calcularEstado(estadoPrevio, intencion, fechaEsFutura);
  return {
    estado,
    // Una sola regla, derivada del resultado: se reinicia si y solo si la
    // licitación retrocede de "En Proceso" a "Programada". Da igual por qué
    // intención llegó ahí.
    reiniciarRondas: estadoPrevio === EN_PROCESO && estado === PROGRAMADA,
  };
}

function calcularEstado(
  estadoPrevio: string,
  intencion: IntencionGuardado,
  fechaEsFutura: boolean
): string {
  switch (intencion) {
    // Las dos intenciones que CONSERVAN el estado, por razones distintas:
    //
    // - guardar_borrador: un borrador no puede DEGRADAR algo ya lanzado (eso
    //   dejaría a proveedores invitados mirando una licitación que desapareció
    //   de su portal), así que si ya salió de Borrador se queda donde está.
    //
    // - preparar_lanzamiento: promover aquí sería promover ANTES de que los
    //   correos salgan. Ver la nota de atomicidad al pie del archivo.
    case "guardar_borrador":
    case "preparar_lanzamiento":
      return estadoPrevio;

    // Arranque inmediato de la captura manual.
    case "iniciar_manual":
      return EN_PROCESO;

    // Editar conserva el estado, con UNA excepción legítima: mover la fecha
    // de inicio al futuro en una licitación ya arrancada la devuelve a
    // Programada. Es el flujo que el modal "Sí, cambiar fecha" le advierte al
    // comprador ("volverá a estado Programada y se reiniciarán las rondas").
    case "editar":
      return estadoPrevio === EN_PROCESO && fechaEsFutura ? PROGRAMADA : estadoPrevio;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Por qué "preparar_lanzamiento" no promueve
//
// Guardar y notificar tienen que ser ATÓMICOS: o pasan los dos, o no pasa
// ninguno. Antes no lo eran. La secuencia era:
//
//   1. el comprador aprieta "Guardar y Notificar Participantes"
//   2. el servidor escribe estado = "Programada"  ← COMMIT, irreversible
//   3. recién entonces el cliente abre el modal de correo
//   4. el comprador le da CANCELAR
//
// …y la licitación quedaba "Programada" sin que nadie hubiera sido invitado.
// Peor: si `fechaEjecucion` ya había pasado, la siguiente carga de página
// hacía que `verificarYActualizarEstado` la promoviera a "En Proceso",
// arrancara la ronda 1 y publicara el aviso — proveedores viendo una
// licitación viva a la que nunca los invitaron.
//
// La cura NO es revertir en el cancelar. Revertir deja una ventana en la que
// la fila está "Programada" y cualquier carga concurrente la arranca, y además
// ensucia LicitacionEstadoLog con Borrador → Programada → Borrador, que es lo
// que alimenta los tiempos por etapa del Tablero. Nunca escribas un estado que
// podrías tener que retirar.
//
// La cura es DIFERIR: el guardado deja la licitación como estaba y la
// promoción viaja junto con el sello de `invitacionesEnviadasEn`, en una sola
// transacción (`lanzarLicitacionAction`), disparada por el `onEnviado` del
// modal — que solo corre si el lote COMPLETO de correos salió bien.
//
// Por eso el único caso "programar" de esta máquina desapareció: la promoción
// ya no es una decisión de guardado.
// ─────────────────────────────────────────────────────────────────────────────
