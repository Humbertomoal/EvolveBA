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
};

/** ¿Esta oferta puede competir por "el precio más bajo"? */
export function esOfertaValida(oferta: OfertaEvaluable): boolean {
  if (oferta.noDisponible) return false;
  return Number.isFinite(oferta.precioUnitario) && oferta.precioUnitario > 0;
}

/** Atajo para el caso más común: quedarse solo con las ofertas que compiten. */
export function soloOfertasValidas<T extends OfertaEvaluable>(ofertas: readonly T[]): T[] {
  return ofertas.filter(esOfertaValida);
}
