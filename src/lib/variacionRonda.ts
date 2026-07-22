// Cálculo de variación de precio unitario "ronda a ronda" dentro de un
// mismo grupo (proveedor + material). Compartido entre la vista del
// proveedor (su propio historial de ofertas) y el histórico de pujas del
// comprador, para que ambas usen exactamente la misma fórmula.

export type OfertaConRonda = {
  ronda: number;
  precioUnitario: number;
};

export type VariacionRonda = {
  /** oferta.precioUnitario - anterior.precioUnitario */
  diffMonto: number;
  /** (diffMonto / anterior.precioUnitario) * 100 */
  diffPct: number;
};

/**
 * Variación de cada oferta de un grupo YA homogéneo (mismo proveedor +
 * mismo material) vs la ronda inmediatamente anterior EN LA QUE ESE GRUPO
 * PUJÓ — no necesariamente ronda-1. `null` para la primera ronda del
 * grupo (no hay anterior con qué comparar).
 */
export function calcularVariacionesGrupo<T extends OfertaConRonda>(
  ofertasGrupo: readonly T[]
): Map<T, VariacionRonda | null> {
  const ordenadas = [...ofertasGrupo].sort((a, b) => a.ronda - b.ronda);
  const resultado = new Map<T, VariacionRonda | null>();

  ordenadas.forEach((oferta, idx) => {
    const anterior = idx > 0 ? ordenadas[idx - 1] : null;
    if (!anterior) {
      resultado.set(oferta, null);
      return;
    }
    const diffMonto = oferta.precioUnitario - anterior.precioUnitario;
    const diffPct =
      anterior.precioUnitario !== 0 ? (diffMonto / anterior.precioUnitario) * 100 : 0;
    resultado.set(oferta, { diffMonto, diffPct });
  });

  return resultado;
}

/**
 * Igual que calcularVariacionesGrupo pero para una lista plana que mezcla
 * varios grupos (p.ej. varios proveedores y/o materiales): agrupa según
 * `claveGrupo` antes de calcular cada uno por separado.
 */
export function calcularVariacionesPorGrupo<T extends OfertaConRonda>(
  ofertas: readonly T[],
  claveGrupo: (o: T) => string
): Map<T, VariacionRonda | null> {
  const grupos = new Map<string, T[]>();
  for (const oferta of ofertas) {
    const clave = claveGrupo(oferta);
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(oferta);
    else grupos.set(clave, [oferta]);
  }

  const resultado = new Map<T, VariacionRonda | null>();
  for (const grupo of grupos.values()) {
    for (const [oferta, variacion] of calcularVariacionesGrupo(grupo)) {
      resultado.set(oferta, variacion);
    }
  }
  return resultado;
}
