// ─────────────────────────────────────────────────────────────────────────────
// "Duplicar licitación" — forma de los datos con los que se PRELLENA el
// formulario de creación. Módulo PURO (sin Prisma): lo consume LicitacionForm,
// que es un Client Component, y un import con Prisma arrastraría pg/node:util al
// bundle y tumbaría el build.
//
// ── Por qué no se reusa `PreDatos` ─────────────────────────────────────────
// `PreDatos` es el prop `inicial` de LicitacionForm, y ese prop es el que
// ENCIENDE el modo edición (`modoEdicion = inicial !== undefined`). Prellenar
// con él haría que el guardado actualizara la licitación ORIGINAL en vez de
// crear una nueva. La copia viaja por un prop aparte, con esta forma, que a
// propósito NO trae:
//
//   · `numero`  de la copia: el formulario usa el siguiente disponible.
//   · `estado`:              la copia nace en Borrador.
//   · `items[].id`:          sin identidad en la base, el servidor las CREA.
//   · `items[].eliminado` / `tieneDependencias`: las partidas retiradas no se
//     copian, así que ninguna de las dos aplica.
//
// `numeroOriginal` sí viaja, pero solo para el banner "Duplicado de la
// licitación X" y los avisos; nunca se guarda.
// ─────────────────────────────────────────────────────────────────────────────

/** Una partida copiada, sin identidad en la base. */
export type ItemLicitacionBase = {
  productoId: string;
  unidadMedida: string;
  especificacion: string;
  fechaEntrega: string;
  cantidadSolicitada: string;
  precioObjetivo: string;
  moneda: string;
};

export type LicitacionBase = {
  /** Id de la ORIGINAL. Viaja al servidor para copiar sus archivos adjuntos. */
  id: string;
  /** Número de la ORIGINAL, solo para el banner. La copia recibe uno nuevo. */
  numeroOriginal: string;
  jerarquia: string;
  tipoLicitacion: string;
  costoObjetivo: string;
  fechaEjecucion: string;
  fechaFinLicitacion: string;
  fechaInicioRangoEntrega: string;
  fechaFinRangoEntrega: string;
  duracionValor: string;
  /** Misma forma que `UnidadDuracion` del formulario, sin importarlo. */
  duracionUnidad: "minutos" | "horas" | "dias";
  maxRondas: string;
  instrucciones: string;
  /** URLs de Storage de la ORIGINAL. El servidor las copia al guardar. */
  archivosAdjuntos: string[];
  modoLicitacion: string;
  items: ItemLicitacionBase[];
  proveedoresInvitados: string[];
  /** Tipos de cambio CONGELADOS de la original (no los actuales de Settings). */
  tiposCambio: Record<string, number>;
  monedaConsolidacion: string;
};
