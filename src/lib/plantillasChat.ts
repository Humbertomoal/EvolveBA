// ─────────────────────────────────────────────────────────────────────────────
// Textos de los avisos automáticos que el sistema publica en el chat de cada
// proveedor cuando cambia la ronda de una licitación.
//
// Módulo PURO (0 imports): lo usa el servidor al publicar el aviso, y queda
// disponible para el cliente si algún día hay que previsualizar el texto.
//
// Los textos tienen un rol PSICOLÓGICO deliberado: el de nueva ronda invita a
// mejorar la oferta SIEMPRE, sin evaluar si de verdad hubo una mejora. Por eso
// aquí no se consulta ninguna oferta — el aviso se arma solo con el número de
// ronda, y eso mantiene barata cada transición.
// ─────────────────────────────────────────────────────────────────────────────

/** Qué ocurrió con la ronda. Lo construye quien detecta la transición. */
export type EventoAvisoRonda =
  | { tipo: "nueva_ronda"; ronda: number }
  | { tipo: "cierre"; ultimaRonda: number }
  | { tipo: "cambio_licitacion" };

const ORDINALES_FEMENINOS = [
  "primera",
  "segunda",
  "tercera",
  "cuarta",
  "quinta",
  "sexta",
  "séptima",
  "octava",
  "novena",
  "décima",
];

/**
 * Ordinal femenino de una ronda: 1 → "primera" … 10 → "décima".
 *
 * De 11 en adelante devuelve la forma abreviada ("11.ª") y NO "ronda 11": las
 * plantillas insertan esto en dos huecos distintos —"La [x] ronda ha concluido"
 * y "Se generará una [x] ronda"— así que un texto que ya incluya la palabra
 * "ronda" produciría "una ronda 11 ronda". La forma abreviada encaja en ambos.
 * Es alcanzable: la licitación 0006 tiene 7 rondas y las rondas extra suman.
 */
export function ordinalRonda(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "primera";
  const indice = Math.floor(n) - 1;
  return ORDINALES_FEMENINOS[indice] ?? `${Math.floor(n)}.ª`;
}

/** Arranque de la licitación: se abre la ronda 1. */
export function inicioRonda1(): string {
  return (
    "Ha comenzado la licitación y se encuentra abierta la primera ronda de " +
    "ofertas. En esta primera ronda registra tu oferta de precios unitarios " +
    "por partida en los campos de la licitación. En caso de que alguno de los " +
    "participantes mejore los precios, se generará una segunda ronda para " +
    "darle a todos la oportunidad de volver a competir."
  );
}

/** Se abre la ronda 2. */
export function segundaRonda(): string {
  return (
    "Estimado Proveedor, la primera ronda ha concluido. Uno de los proveedores " +
    "participantes ha ofrecido un precio más eficiente que los demás. En unos " +
    "segundos iniciará una segunda ronda, en esta segunda ronda tienen la " +
    "oportunidad de mejorar su oferta de precios anterior. En caso de que " +
    "alguno de los participantes mejore, en esta segunda ronda, el mejor " +
    "precio ofrecido en la primera ronda, se generará una tercera ronda. Para " +
    "hacer tu oferta de precios en esta segunda ronda registra tu oferta de " +
    "precios unitarios por partida en los campos de la licitación."
  );
}

/** Se abre la ronda `n`, con n ≥ 3. */
export function rondaExtra(n: number): string {
  const previa = ordinalRonda(n - 1);
  const actual = ordinalRonda(n);
  return (
    `La ${previa} ronda ha concluido y uno de los participantes mejoró el ` +
    `precio más eficiente de la ronda previa. Se generará una ${actual} ronda ` +
    "para darle la oportunidad a todos de volver a competir. En caso de que " +
    "desees mejorar tu oferta de precios de las rondas pasadas, registra tu " +
    "oferta de precios unitarios por partida en los campos de la licitación " +
    `de esta ${actual} ronda.`
  );
}

/** Se cerraron las rondas: la licitación pasa a decisión final. */
export function cierre(ultimaRonda: number): string {
  return (
    `La ${ordinalRonda(ultimaRonda)} ronda ha concluido. Hemos llegado a los ` +
    "mejores precios para esta licitación, ya que ninguno de los participantes " +
    "mejoró el precio más eficiente de la ronda anterior. Agradecemos la " +
    "participación de todos. En los próximos días nos comunicaremos con los " +
    "participantes seleccionados para proveer alguna de las partidas dentro " +
    "de esta licitación."
  );
}

/**
 * La licitación cambió mientras estaba en curso.
 *
 * Deliberadamente CORTO y sin detalle de qué cambió. El aviso va al chat de
 * TODOS los invitados y cada proveedor ve solo las partidas de su catálogo
 * (ver `filtrarItemsPorMaterialesProveedor`), así que enumerar "se agregó 1
 * partida" podría referirse a algo que ese proveedor no puede ver. Y el
 * detalle completo ya está donde importa: en la licitación misma, que es a
 * donde este mensaje lo manda.
 *
 * Es el MISMO primer párrafo que encabeza el correo AJUSTE_LICITACION, para
 * que chat y correo digan lo mismo con las mismas palabras.
 */
export function cambioLicitacion(): string {
  return (
    "Estimado Proveedor, se realizó un ajuste en la licitación. " +
    "Te invitamos a revisarla y actualizar tu oferta de precios si es necesario."
  );
}

/**
 * Texto que corresponde a un evento. La selección va por NÚMERO de ronda, no
 * por la acción que disparó la transición: da igual si la ronda 3 la abrió el
 * reloj, el botón de forzar avance o el de ronda extra — al proveedor le llega
 * el mismo mensaje, que es lo que se quiere.
 */
export function textoAvisoRonda(evento: EventoAvisoRonda): string {
  if (evento.tipo === "cambio_licitacion") return cambioLicitacion();
  if (evento.tipo === "cierre") return cierre(evento.ultimaRonda);
  if (evento.ronda <= 1) return inicioRonda1();
  if (evento.ronda === 2) return segundaRonda();
  return rondaExtra(evento.ronda);
}
