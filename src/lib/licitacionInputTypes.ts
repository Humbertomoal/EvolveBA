// ─────────────────────────────────────────────────────────────────────────────
// Forma del payload que el formulario de licitación manda al servidor.
//
// Módulo PURO (solo importa otro tipo puro): lo consumen a la vez
// `licitacionesActions.ts` (que es "use server") y el formulario del cliente.
//
// ── Por qué no vive en el "use server" ─────────────────────────────────────
// Un "use server" exporta SOLO funciones async. Un `export type` ahí se
// compila mal con Turbopack: arma la lista de exports antes de que TypeScript
// borre los tipos y emite una referencia a un símbolo inexistente
// → ReferenceError al evaluar el módulo. Ya costó una caída (ver la nota de
// avisosProveedorTypes.ts). Estos tipos estaban en licitacionesActions.ts por
// inercia; al tocarlos para la edición incremental se mudan a donde tocaba.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntencionGuardado } from "@/src/lib/licitacionesIntencion";

/**
 * Una partida del formulario.
 *
 * ── El campo `id` es la pieza central de la edición incremental ────────────
 * Hasta ahora el payload NO traía identidad de fila: el formulario mandaba
 * `items.map(({ _id, ...rest }) => rest)`, descartando la llave. Sin identidad
 * el servidor no podía casar una fila del formulario con su fila en la base,
 * así que la única reconciliación posible era `deleteMany` + `createMany`:
 * borrar TODAS las partidas y recrearlas en cada guardado.
 *
 * Eso funcionaba mientras nadie hubiera cotizado. En cuanto existe una oferta,
 * `OfertaItem_licitacionItemId_fkey` (RESTRICT) rechaza el borrado y el
 * guardado entero falla — el error que apareció al editar la licitación 0016.
 * Y de paso, cada guardado se llevaba por delante el borrador de negociación
 * del comprador (SeleccionPrecioComprador colgaba de un CASCADE).
 *
 * Con `id`, el servidor distingue:
 *   · `id` presente → esa fila ya existe: UPDATE, conservando sus ofertas.
 *   · `id` ausente  → fila nueva: CREATE.
 *
 * Es OPCIONAL porque una partida recién agregada en pantalla todavía no existe
 * en la base. NO confundir con `ItemFila._id` del formulario, que es una llave
 * de React presente siempre (también en las filas nuevas).
 */
export type ItemInput = {
  /** Id real en la base. `undefined` = partida nueva, aún no persistida. */
  id?: string;
  /**
   * true = el comprador quitó esta partida, pero tiene ofertas/asignaciones y
   * NO puede borrarse (las tres FK son RESTRICT): se OCULTA.
   *
   * Viaja explícito en el payload en vez de deducirse de la ausencia de la fila
   * porque el formulario SIGUE mostrando las partidas ocultas (tachadas, para
   * poder restaurarlas). Sin este campo, un guardado que no tocara nada las
   * mandaría de vuelta como presentes y el servidor las restauraría solas.
   */
  eliminado?: boolean;
  productoId: string;
  unidadMedida: string;
  especificacion: string;
  fechaEntrega: string;
  cantidadSolicitada: string;
  precioObjetivo: string;
  moneda: string;
};

export type LicitacionInput = {
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  costoObjetivo: number | null;
  fechaEjecucion: string | null;
  fechaFinLicitacion: string | null;
  fechaInicioRangoEntrega: string | null;
  fechaFinRangoEntrega: string | null;
  duracionRondaMinutos: number;
  maxRondas: number;
  instrucciones: string | null;
  archivosAdjuntos: string[];
  // Qué botón se apretó. El servidor decide el estado a partir de ESTO y del
  // estado que la licitación ya tenía en la base — nunca infiriéndolo de la
  // fecha (causa del bug de invitaciones de la 0016) ni aceptándolo del
  // cliente. AQUÍ NO VA UN CAMPO `estado`: lo había, `crearLicitacionAction`
  // lo escribía verbatim, y por esa rendija se colaba la promoción silenciosa
  // a "Programada" en el camino de CREACIÓN, esquivando `resolverEstado`.
  intencion: IntencionGuardado;
  modoLicitacion: string;
  items: ItemInput[];
  proveedoresInvitados: string[];
  // Tipos de cambio congelados (respecto a MXN), ej. { USD: 17.2 }. MXN no se guarda.
  tiposCambio?: Record<string, number>;
  // Moneda de consolidación de los totales (default MXN).
  monedaConsolidacion?: string;
};
