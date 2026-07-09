// Lógica de cálculo de ahorro compartida entre el tab "Mejores Precios" de
// licitaciones-proceso y la tabla de Selección de Proveedores, para que
// ambas vistas usen exactamente las mismas fórmulas.

export type LicitacionItemParaAhorro = {
  id: string;
  cantidadSolicitada: number;
  precioObjetivo: number | null;
  moneda: string;
};

export type OfertaParaAhorro = {
  licitacionItemId: string;
  ronda: number;
  precioUnitario: number;
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
};

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
    const itemOfertas = ofertas.filter((o) => o.licitacionItemId === item.id);
    const precios = itemOfertas.map((o) => o.precioUnitario);
    const mejorActualUnitario = precios.length > 0 ? Math.min(...precios) : null;

    let primeraRondaUnitario: number | null = null;
    if (itemOfertas.length > 0) {
      const primeraRondaConPuja = Math.min(...itemOfertas.map((o) => o.ronda));
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

    return {
      licitacionItemId: item.id,
      moneda: item.moneda,
      cantidadSolicitada: item.cantidadSolicitada,
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

/** Agrega el análisis por material en los totales/KPIs de la licitación. */
export function calcularResumenAhorro(
  analisis: AnalisisItemAhorro[],
  hayOfertas: boolean
): ResumenAhorroCalculado {
  const presupuestoObjetivoTotal = analisis.reduce((s, a) => s + a.objetivoTotal, 0);
  const mejorPrecioActualTotal = analisis.reduce(
    (s, a) => s + (a.mejorActualTotal ?? 0),
    0
  );
  const primeraRondaTotal = analisis.reduce(
    (s, a) => s + (a.primeraRondaTotal ?? 0),
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

  return {
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
