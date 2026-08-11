// ─────────────────────────────────────────────────────────────────────────────
// Línea base de ahorro por partida — modelo de PROMEDIO de dos bolsas.
//
// Módulo puro: su único import es `ofertaValida`, que a su vez tiene 0 imports.
// Nada de Prisma, así que también sirve en el cliente.
//
// ── Qué cambia respecto al modelo viejo ────────────────────────────────────
// `licitacionesAhorro.ts` mide contra el MÍNIMO de la primera ronda con puja.
// Un solo proveedor agresivo en la ronda 1 fijaba la referencia de toda la
// partida. Aquí la referencia es el promedio de lo que ofreció el mercado en
// sus dos primeras posturas, que es más representativo de "cuánto costaba esto
// antes de negociar".
//
// ── Por qué DOS bolsas y no una ────────────────────────────────────────────
// Promediar 1ª y 2ª postura en una sola bolsa le daría doble peso a quien
// cotizó dos veces frente a quien solo cotizó una. Con dos bolsas y un 50/50
// final, cada RONDA pesa lo mismo sin importar cuántos proveedores la poblaron.
// ─────────────────────────────────────────────────────────────────────────────

import { esOfertaValida } from "./ofertaValida";

/** Factor de corte de outliers: fuera si precio > K×mediana o < mediana/K. */
export const K_OUTLIER = 4;

export type RegistroPuja = {
  proveedorId: string;
  ronda: number;
  precioUnitario: number;
  /** Ver ofertaValida.ts. Ausente equivale a false. */
  noDisponible?: boolean | null;
};

export type ProveedorExcluido = {
  proveedorId: string;
  /** Todos sus registros quedaron fuera del rango de la mediana. */
  motivo: "todos_outlier";
  precios: number[];
};

export type LineaBasePartida = {
  /** Promedio 50/50 de las dos bolsas. null = no hubo con qué calcular. */
  lineaBase: number | null;
  promedioBolsa1: number | null;
  promedioBolsa2: number | null;
  /** Precios que entraron a cada bolsa, para poder auditar el número. */
  bolsa1: number[];
  bolsa2: number[];
  /** Mediana de referencia con la que se marcaron los outliers. */
  mediana: number | null;
  limiteInferior: number | null;
  limiteSuperior: number | null;
  /** Proveedores que quedaron fuera por completo, con sus precios. */
  excluidos: ProveedorExcluido[];
  /** Registros sueltos descartados de proveedores que SÍ participan. */
  registrosDescartados: number;
};

/** Mediana de una lista no vacía. Devuelve null si está vacía. */
export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const medio = ord.length >> 1;
  return ord.length % 2 === 1 ? ord[medio] : (ord[medio - 1] + ord[medio]) / 2;
}

function promedio(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, x) => s + x, 0) / valores.length;
}

/**
 * Registros de cada proveedor, ordenados por ronda ascendente.
 * "Primera ronda de un proveedor" = su primer registro real, aunque sea la
 * ronda 3 literal porque entró tarde.
 */
export function agruparPorProveedor(
  registros: readonly RegistroPuja[]
): Map<string, RegistroPuja[]> {
  const mapa = new Map<string, RegistroPuja[]>();
  for (const r of registros) {
    const previos = mapa.get(r.proveedorId);
    if (previos) previos.push(r);
    else mapa.set(r.proveedorId, [r]);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.ronda - b.ronda);
  return mapa;
}

/**
 * Mediana de referencia de la partida: el PRIMER registro de cada proveedor.
 *
 * ── Por qué esto no es circular ────────────────────────────────────────────
 * Para marcar outliers hace falta una referencia, y una referencia "limpia"
 * parecería exigir haber quitado antes los outliers. La circularidad se rompe
 * eligiendo un estimador que NO necesita datos limpios: la mediana tiene punto
 * de ruptura del 50 %, así que hasta ⌊(n−1)/2⌋ valores arbitrariamente absurdos
 * no la sacan del rango de los datos buenos. Con los 4 proveedores típicos
 * tolera uno corrupto; con 5, dos. En el histórico real nunca hubo más de dos
 * outliers en una misma partida.
 *
 * Por eso la mediana se calcula sobre los datos CRUDOS, una sola vez, y NO se
 * recalcula después de excluir: recalcular sería iterativo y cada exclusión
 * correría la referencia, pudiendo arrastrar en cascada a proveedores
 * legítimos. Una pasada, referencia fija.
 *
 * Se usa UN valor por proveedor (su primer registro) y no todos sus registros:
 * si no, quien cotizó seis veces pesaría seis veces en la referencia.
 */
export function medianaReferencia(
  porProveedor: ReadonlyMap<string, RegistroPuja[]>
): number | null {
  const foto: number[] = [];
  for (const registros of porProveedor.values()) {
    if (registros.length > 0) foto.push(registros[0].precioUnitario);
  }
  return mediana(foto);
}

/**
 * Línea base de una partida.
 *
 * Orden de operaciones:
 *   1. Se descartan los registros no válidos (precio ≤ 0 o "no dispongo"):
 *      quien no cotizó no entra.
 *   2. Se agrupa por proveedor y se ordena por ronda.
 *   3. Mediana de referencia con el primer registro de cada uno (ver arriba).
 *   4. Se marca outlier CADA REGISTRO fuera de [mediana/K, mediana×K]. Es por
 *      registro y no por proveedor a propósito: así, quien se equivocó en una
 *      ronda y corrigió después conserva su registro corregido.
 *   5. De los registros válidos de cada proveedor, el 1º va a la bolsa 1 y el
 *      2º a la bolsa 2. Con un solo válido, va SOLO a la bolsa 1: duplicarlo
 *      inventaría una postura que nunca ocurrió.
 *   6. Un proveedor con TODOS sus registros fuera de rango se excluye entero.
 *   7. Línea base = (promedio bolsa 1 + promedio bolsa 2) / 2. Si una bolsa
 *      quedó vacía, la base es la otra sin más.
 */
export function calcularLineaBasePartida(
  registros: readonly RegistroPuja[]
): LineaBasePartida {
  const vacio: LineaBasePartida = {
    lineaBase: null,
    promedioBolsa1: null,
    promedioBolsa2: null,
    bolsa1: [],
    bolsa2: [],
    mediana: null,
    limiteInferior: null,
    limiteSuperior: null,
    excluidos: [],
    registrosDescartados: 0,
  };

  // (1) Solo pujas reales. `esOfertaValida` ya cubre precio ≤ 0 y "no dispongo".
  const validos = registros.filter(esOfertaValida);
  if (validos.length === 0) return vacio;

  // (2) y (3)
  const porProveedor = agruparPorProveedor(validos);
  const med = medianaReferencia(porProveedor);
  if (med === null || med <= 0) return vacio;

  const limiteSuperior = med * K_OUTLIER;
  const limiteInferior = med / K_OUTLIER;
  const dentroDeRango = (p: number) => p >= limiteInferior && p <= limiteSuperior;

  const bolsa1: number[] = [];
  const bolsa2: number[] = [];
  const excluidos: ProveedorExcluido[] = [];
  let registrosDescartados = 0;

  for (const [proveedorId, regs] of porProveedor) {
    // (4) marcado por registro
    const enRango = regs.filter((r) => dentroDeRango(r.precioUnitario));

    if (enRango.length === 0) {
      // (6) el proveedor entero queda fuera
      excluidos.push({
        proveedorId,
        motivo: "todos_outlier",
        precios: regs.map((r) => r.precioUnitario),
      });
      continue;
    }

    registrosDescartados += regs.length - enRango.length;

    // (5) primero a la bolsa 1, segundo a la bolsa 2. Sin duplicar.
    bolsa1.push(enRango[0].precioUnitario);
    if (enRango.length > 1) bolsa2.push(enRango[1].precioUnitario);
  }

  const promedioBolsa1 = promedio(bolsa1);
  const promedioBolsa2 = promedio(bolsa2);

  // (7) 50/50 entre rondas. Con una bolsa vacía manda la otra: promediar contra
  // un 0 inexistente hundiría la referencia a la mitad.
  let lineaBase: number | null;
  if (promedioBolsa1 !== null && promedioBolsa2 !== null) {
    lineaBase = (promedioBolsa1 + promedioBolsa2) / 2;
  } else {
    lineaBase = promedioBolsa1 ?? promedioBolsa2;
  }

  return {
    lineaBase,
    promedioBolsa1,
    promedioBolsa2,
    bolsa1,
    bolsa2,
    mediana: med,
    limiteInferior,
    limiteSuperior,
    excluidos,
    registrosDescartados,
  };
}

/**
 * Referencia OPTIMISTA: el precio más bajo válido de la partida entre todas las
 * rondas. Es la vista previa "con mínimos" — el mismo criterio del modelo viejo
 * de mejor precio, expuesto aparte para poder comparar las dos referencias.
 */
export function calcularMinimoPartida(
  registros: readonly RegistroPuja[]
): number | null {
  const precios = registros.filter(esOfertaValida).map((r) => r.precioUnitario);
  return precios.length > 0 ? Math.min(...precios) : null;
}

/** Ahorro de una partida: (línea base − valor final) × cantidad. */
export function calcularAhorroPartida(
  lineaBaseUnitaria: number | null,
  valorFinalUnitario: number | null,
  cantidad: number
): number | null {
  if (lineaBaseUnitaria === null || valorFinalUnitario === null) return null;
  return (lineaBaseUnitaria - valorFinalUnitario) * cantidad;
}
