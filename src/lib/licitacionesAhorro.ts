// Lógica de cálculo de ahorro compartida entre el tab "Mejores Precios" de
// licitaciones-proceso y la tabla de Selección de Proveedores, para que
// ambas vistas usen exactamente las mismas fórmulas.

import { convertirAMoneda, MONEDA_BASE, type TiposCambio } from "./conversionMoneda";
import { soloOfertasValidas } from "./ofertaValida";
import {
  calcularLineaBasePartida,
  type LineaBasePartida,
} from "./ahorroPromedio";

export type LicitacionItemParaAhorro = {
  id: string;
  cantidadSolicitada: number;
  precioObjetivo: number | null;
  moneda: string;
};

export type OfertaParaAhorro = {
  licitacionItemId: string;
  /**
   * REQUERIDO por el modelo de línea base promedio (ahorroPromedio.ts), que
   * agrupa por proveedor. Se dejó obligatorio a propósito: si fuera opcional,
   * un call site que olvidara pedirlo en el select caería en silencio al
   * modelo viejo y nadie lo notaría.
   */
  proveedorId: string;
  ronda: number;
  precioUnitario: number;
  /** Ver ofertaValida.ts. Opcional: ausente equivale a false. */
  noDisponible?: boolean | null;
};

export type AnalisisItemAhorro = {
  licitacionItemId: string;
  moneda: string;
  cantidadSolicitada: number;
  objetivoUnitario: number | null;
  objetivoTotal: number;
  primeraRondaUnitario: number | null;
  primeraRondaTotal: number | null;
  mejorActualUnitario: number | null;
  mejorActualTotal: number | null;
  variacionPct: number | null;
  ahorroTotal: number | null;
  // ── Modelo NUEVO (promedio de dos bolsas) — convive con el viejo ─────────
  // El viejo (primeraRondaUnitario / ahorroTotal) NO se borra: sigue
  // disponible como referencia mientras se validan los números nuevos.
  /** Línea base = promedio 50/50 de la 1ª y 2ª postura del mercado. */
  lineaBasePromedioUnitario: number | null;
  lineaBasePromedioTotal: number | null;
  /** Desglose auditable: bolsas, mediana, límites y quién quedó excluido. */
  detalleLineaBase: LineaBasePartida;
};

export type ResumenAhorroCalculado = {
  presupuestoObjetivoTotal: number;
  primeraRondaTotal: number;
  mejorPrecioActualTotal: number;
  adherenciaPct: number;
  ahorroTotal: number;
  ahorroPct: number | null;
  variacionPct: number | null;
  hayOfertas: boolean;
  // ── Modelo NUEVO ────────────────────────────────────────────────────────
  /** Suma de las líneas base promedio de cada partida. */
  lineaBasePromedioTotal: number;
  /** lineaBasePromedioTotal − mejorPrecioActualTotal. */
  ahorroPromedioTotal: number;
  ahorroPromedioPct: number | null;
};

/**
 * Primera ronda en la que hay al menos una oferta — no necesariamente la
 * ronda 1. Devuelve null si el conjunto de ofertas está vacío. Es la base
 * de "primera ronda válida" que usan tanto el análisis por material como
 * el total inicial por proveedor (ver página de detalle de licitación).
 */
export function primeraRondaConOferta(ofertas: { ronda: number }[]): number | null {
  if (ofertas.length === 0) return null;
  return Math.min(...ofertas.map((o) => o.ronda));
}

/**
 * Calcula, por cada material, el precio objetivo, el "Precio Primera Ronda"
 * (precio más bajo de la primera ronda en la que hubo al menos una puja —
 * no necesariamente la ronda 1) y el mejor precio entre todas las rondas.
 */
export function calcularAnalisisPorItem(
  items: LicitacionItemParaAhorro[],
  ofertas: OfertaParaAhorro[]
): AnalisisItemAhorro[] {
  return items.map((item) => {
    // Se filtra ANTES de cualquier min: una oferta en 0 (o marcada "no
    // dispongo") no compite por el precio más bajo. Sin esto, un solo 0 se
    // llevaba el mínimo de todas las rondas y hundía el total del material.
    // Y como el filtro se aplica sobre TODAS las rondas, un 0 corregido en una
    // ronda posterior queda descartado y gana el precio real corregido.
    const itemOfertas = soloOfertasValidas(
      ofertas.filter((o) => o.licitacionItemId === item.id)
    );
    const precios = itemOfertas.map((o) => o.precioUnitario);
    const mejorActualUnitario = precios.length > 0 ? Math.min(...precios) : null;

    let primeraRondaUnitario: number | null = null;
    // "Primera ronda con puja" se calcula sobre las ofertas ya filtradas: si en
    // la ronda 1 todos pusieron 0, esa no fue una ronda con precios reales y la
    // base de comparación del ahorro debe ser la primera que sí los tuvo.
    const primeraRondaConPuja = primeraRondaConOferta(itemOfertas);
    if (primeraRondaConPuja != null) {
      const preciosPrimeraRondaValida = itemOfertas
        .filter((o) => o.ronda === primeraRondaConPuja)
        .map((o) => o.precioUnitario);
      primeraRondaUnitario = Math.min(...preciosPrimeraRondaValida);
    }

    const objetivoUnitario: number | null = item.precioObjetivo ?? null;
    const objetivoTotal = (objetivoUnitario ?? 0) * item.cantidadSolicitada;
    const primeraRondaTotal =
      primeraRondaUnitario != null
        ? primeraRondaUnitario * item.cantidadSolicitada
        : null;
    const mejorActualTotal =
      mejorActualUnitario != null
        ? mejorActualUnitario * item.cantidadSolicitada
        : null;
    const variacionPct =
      primeraRondaUnitario != null &&
      mejorActualUnitario != null &&
      primeraRondaUnitario > 0
        ? ((mejorActualUnitario - primeraRondaUnitario) / primeraRondaUnitario) * 100
        : null;
    // Ahorro por material: Primera Ronda − Mejor Actual. Los materiales sin
    // ninguna puja quedan fuera (no se incluyen en los totales de ahorro).
    const ahorroTotal =
      primeraRondaTotal != null && mejorActualTotal != null
        ? primeraRondaTotal - mejorActualTotal
        : null;

    // Modelo nuevo. Se alimenta de TODOS los registros de la partida (incluidos
    // los que el filtro de arriba dejaría fuera por outlier): la exclusión de
    // outliers la decide el propio helper contra la mediana, no este filtro.
    const detalleLineaBase = calcularLineaBasePartida(
      ofertas.filter((o) => o.licitacionItemId === item.id)
    );
    const lineaBasePromedioUnitario = detalleLineaBase.lineaBase;
    const lineaBasePromedioTotal =
      lineaBasePromedioUnitario !== null
        ? lineaBasePromedioUnitario * item.cantidadSolicitada
        : null;

    return {
      licitacionItemId: item.id,
      moneda: item.moneda,
      cantidadSolicitada: item.cantidadSolicitada,
      lineaBasePromedioUnitario,
      lineaBasePromedioTotal,
      detalleLineaBase,
      objetivoUnitario,
      objetivoTotal,
      primeraRondaUnitario,
      primeraRondaTotal,
      mejorActualUnitario,
      mejorActualTotal,
      variacionPct,
      ahorroTotal,
    };
  });
}

/**
 * Agrega el análisis por material en los totales/KPIs de la licitación.
 * Todos los totales se devuelven CONVERTIDOS a `monedaConsolidacion` (default
 * MXN) usando los tipos de cambio congelados de la licitación (cada material se
 * convierte desde su propia moneda). Con `tiposCambio` null/omitido y monedas
 * sin tasa se usa tasa 1 (retrocompatibilidad); el UI debe avisar con
 * `faltanTiposCambio`.
 */
export function calcularResumenAhorro(
  analisis: AnalisisItemAhorro[],
  hayOfertas: boolean,
  tiposCambio?: TiposCambio | null,
  monedaConsolidacion: string = MONEDA_BASE
): ResumenAhorroCalculado {
  const aConsolidacion = (monto: number, moneda: string) =>
    convertirAMoneda(monto, moneda, monedaConsolidacion, tiposCambio);

  const presupuestoObjetivoTotal = analisis.reduce(
    (s, a) => s + aConsolidacion(a.objetivoTotal, a.moneda),
    0
  );
  const mejorPrecioActualTotal = analisis.reduce(
    (s, a) => s + aConsolidacion(a.mejorActualTotal ?? 0, a.moneda),
    0
  );
  const primeraRondaTotal = analisis.reduce(
    (s, a) => s + aConsolidacion(a.primeraRondaTotal ?? 0, a.moneda),
    0
  );

  // Fallback a 1 para evitar división por cero al calcular porcentajes.
  const presupuestoObjetivoSafe = presupuestoObjetivoTotal || 1;
  const primeraRondaSafe = primeraRondaTotal || 1;
  const mejorPrecioActualSafe = mejorPrecioActualTotal || 1;

  // Adherencia de precio: qué tan cerca está el mejor precio actual del objetivo.
  const adherenciaPct = (presupuestoObjetivoTotal / mejorPrecioActualSafe) * 100;

  // Ahorro vs. la primera ronda con puja (no vs. el objetivo).
  const ahorroTotal = primeraRondaTotal - mejorPrecioActualTotal;
  const ahorroPct = (ahorroTotal / primeraRondaSafe) * 100;
  const variacionPct =
    primeraRondaTotal > 0
      ? ((mejorPrecioActualTotal - primeraRondaTotal) / primeraRondaSafe) * 100
      : null;

  // Modelo nuevo: la referencia es el promedio del mercado, no el mínimo de la
  // primera ronda. El valor final sigue siendo el mismo (mejorPrecioActual),
  // que el llamador ya sustituye por el precio asignado cuando la licitación
  // está finalizada.
  const lineaBasePromedioTotal = analisis.reduce(
    (s, a) => s + aConsolidacion(a.lineaBasePromedioTotal ?? 0, a.moneda),
    0
  );
  const ahorroPromedioTotal = lineaBasePromedioTotal - mejorPrecioActualTotal;
  const ahorroPromedioPct =
    lineaBasePromedioTotal > 0
      ? (ahorroPromedioTotal / lineaBasePromedioTotal) * 100
      : null;

  return {
    lineaBasePromedioTotal,
    ahorroPromedioTotal,
    ahorroPromedioPct,
    presupuestoObjetivoTotal,
    primeraRondaTotal,
    mejorPrecioActualTotal,
    adherenciaPct,
    ahorroTotal,
    ahorroPct,
    variacionPct,
    hayOfertas,
  };
}
