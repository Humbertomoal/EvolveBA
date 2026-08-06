// ─────────────────────────────────────────────────────────────────────────────
// Sobrecosto del proveedor en las licitaciones que PERDIÓ — lógica PURA.
//
// Es el único indicador del portal sin equivalente en el tablero del comprador:
// responde "cuando no ganaste, ¿por cuánto te pasaste del precio ganador?".
//
// ── Definición de "material perdido" ───────────────────────────────────────
// Un LicitacionItem cuenta como perdido por el proveedor X cuando:
//   1. X ofertó en ese material (tiene OfertaItem), y
//   2. X NO tiene ninguna asignación en ese material, y
//   3. hubo un ganador real: al menos una AsignacionMaterial NO rechazada.
//
// La condición 3 importa: sin ganador no hay contra qué comparar, y una
// asignación rechazada por el proveedor no representa una compra. Y la 2 se
// evalúa sobre asignaciones no rechazadas también: si X ganó una parte del
// material (asignación repartida), no lo perdió.
//
// ── Multi-moneda ───────────────────────────────────────────────────────────
// Los dos precios se convierten a MXN ANTES de restarse, cada uno con SU
// moneda: la oferta con LicitacionItem.moneda (nunca OfertaItem.moneda, que es
// columna muerta) y el precio ganador con AsignacionMaterial.moneda. Restar sin
// convertir daría basura en las licitaciones en USD.
//
// Este módulo NO importa Prisma: recibe formas mínimas ya convertidas a MXN por
// el call site, que es quien tiene los tipos de cambio de la licitación.
// ─────────────────────────────────────────────────────────────────────────────

/** Un material perdido, con ambos precios ya en MXN. */
export type MaterialPerdido = {
  productoId: string;
  productoEtiqueta: string;
  /** Mejor precio unitario que ofertó el proveedor, en MXN. */
  precioOfertadoMXN: number;
  /** Precio unitario al que se adjudicó el material, en MXN. */
  precioGanadorMXN: number;
  /** Cantidad realmente adjudicada del material (volumen en juego). */
  cantidad: number;
};

export type SobrecostoProducto = {
  productoId: string;
  etiqueta: string;
  /** Σ (precioOfertado − precioGanador) × cantidad, solo materiales con exceso. */
  sobrecostoMXN: number;
  /** % de exceso sobre el precio ganador, ponderado por cantidad. */
  sobrecostoPct: number;
  /** Materiales perdidos con precio por ENCIMA del ganador. */
  materiales: number;
};

export type ResumenSobrecosto = {
  porProducto: SobrecostoProducto[];
  /** Materiales donde ofertó MÁS BARATO que el ganador y aun así no ganó. */
  perdidosMasBaratos: number;
  /** Total de materiales perdidos analizados. */
  perdidosTotal: number;
  sobrecostoTotalMXN: number;
};

/**
 * Agrega los materiales perdidos por producto.
 *
 * Los materiales donde el proveedor ofertó MÁS BARATO que el ganador quedan
 * fuera del sobrecosto (su exceso es negativo y contaminaría la suma), pero se
 * cuentan aparte: perder ofertando más barato es información comercial valiosa
 * —significa que la decisión no fue por precio— y merece decirse, no esconderse.
 */
export function agregarSobrecosto(
  perdidos: MaterialPerdido[]
): ResumenSobrecosto {
  type Acc = {
    etiqueta: string;
    sobrecostoMXN: number;
    // Para el % ponderado: Σ(exceso × cantidad) / Σ(precioGanador × cantidad).
    baseGanadorMXN: number;
    materiales: number;
  };
  const porProducto = new Map<string, Acc>();
  let perdidosMasBaratos = 0;

  for (const m of perdidos) {
    const exceso = m.precioOfertadoMXN - m.precioGanadorMXN;
    if (exceso <= 0) {
      perdidosMasBaratos++;
      continue;
    }
    const acc = porProducto.get(m.productoId) ?? {
      etiqueta: m.productoEtiqueta,
      sobrecostoMXN: 0,
      baseGanadorMXN: 0,
      materiales: 0,
    };
    acc.sobrecostoMXN += exceso * m.cantidad;
    acc.baseGanadorMXN += m.precioGanadorMXN * m.cantidad;
    acc.materiales++;
    porProducto.set(m.productoId, acc);
  }

  const filas: SobrecostoProducto[] = [];
  for (const [productoId, acc] of porProducto) {
    filas.push({
      productoId,
      etiqueta: acc.etiqueta,
      sobrecostoMXN: acc.sobrecostoMXN,
      // Ponderado por el volumen adjudicado, no promedio simple de porcentajes:
      // un material de 500 piezas pesa más que uno de 2.
      sobrecostoPct:
        acc.baseGanadorMXN > 0
          ? Math.round((acc.sobrecostoMXN / acc.baseGanadorMXN) * 1000) / 10
          : 0,
      materiales: acc.materiales,
    });
  }

  return {
    porProducto: filas.sort((a, b) => b.sobrecostoMXN - a.sobrecostoMXN),
    perdidosMasBaratos,
    perdidosTotal: perdidos.length,
    sobrecostoTotalMXN: filas.reduce((s, f) => s + f.sobrecostoMXN, 0),
  };
}
