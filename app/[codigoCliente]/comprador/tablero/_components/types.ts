import type {
  FiltrosTablero,
  OpcionProducto,
  OpcionProveedor,
} from "@/src/lib/tableroFiltros";

// Los filtros activos SON los filtros canónicos del tablero: el tipo vive en
// src/lib/tableroFiltros.ts (módulo puro) para que server y cliente compartan
// una sola definición. El alias se conserva por compatibilidad con el nombre
// que ya usaba TableroView.
export type FiltrosActivos = FiltrosTablero;

export type TableroData = {
  kpis: {
    licitacionesTotales: number;
    /** Licitaciones ejecutadas (Cerrada · Esperando Validación · Finalizada). */
    licitacionesEjecutadas: number;
    // ── Grupo 1: los tres cuadran por construcción ──────────────────────────
    // ahorroTotal = valorPrimeraRonda − valorMejoresPrecios, sobre el mismo
    // universo (ejecutadas) y consolidado a MXN. Se restan los totales en vez
    // de sumar los ahorros por licitación para que la resta de las tarjetas
    // cierre exacta en pantalla.
    valorPrimeraRonda: number;
    valorMejoresPrecios: number;
    ahorroTotal: number;
    adherenciaPrecios: number | null;
    onTimeDelivery: number | null;
  };
  /**
   * Grupo 2 — foto del pipeline al día de hoy. NO depende del filtro de
   * periodo (sí de familia/producto/proveedor): si el periodo aplicara, las
   * licitaciones más atoradas quedarían fuera, que son justo las que interesan.
   */
  pipeline: {
    /** Las 6 categorías son DISJUNTAS y suman el total de licitaciones. */
    categorias: {
      clave: string;
      label: string;
      cantidad: number;
      tiempoPromedioHoras: number | null;
    }[];
    /** Subconjunto de "Terminadas" (no suma aparte): Finalizada con OC Pendiente. */
    sinOcEnviada: { cantidad: number; tiempoPromedioHoras: number | null };
    cantidadPorMes: {
      mes: string;
      etiqueta: string;
      porCategoria: Record<string, number>;
    }[];
    tiempoPorMes: {
      mes: string;
      etiqueta: string;
      porCategoria: Record<string, number | null>;
    }[];
    sinOcPorMes: {
      mes: string;
      etiqueta: string;
      cantidad: number;
      tiempoPromedioHoras: number | null;
    }[];
    /** Cobertura: entradas al estado tomadas de la bitácora vs. aproximadas. */
    entradasExactas: number;
    entradasTotales: number;
  };
  /** Ahorro por mes de cierre (fechaCerrada ?? fechaFinalizada ?? fechaCreacion). */
  ahorroMensual: {
    mes: string; // "2026-03", ordenable
    etiqueta: string; // "mar 2026"
    ahorro: number;
  }[];
  tiempoEtapas: {
    etapas: { etapa: string; promedioHoras: number; licitaciones: number }[];
    licitacionesUtilizables: number;
    licitacionesTotales: number;
    intervalosDescartados: number;
  };
  precioChart: {
    numero: string;
    jerarquia: string | null;
    precioInicial: number;
    precioFinal: number;
    ahorro: number;
    ahorroPercent: number;
  }[];
  ahorroMaterial: {
    // Se agrupa por productoId, no por nombre: dos productos con el mismo
    // nombre y distinto código son materiales distintos y no deben fusionarse.
    productoId: string;
    productoCodigo: string;
    productoNombre: string;
    familia: string | null;
    cantidadTotal: number;
    // Precios promedio en MXN, misma base que el detalle: primera ronda vs.
    // mejor precio (el ahorro = primera ronda − mejor precio).
    precioPrimeraRondaPromedio: number;
    precioMejorPromedio: number;
    ahorroTotal: number;
  }[];
  onTimeProveedor: {
    proveedorNombre: string;
    /** Órdenes MEDIBLES (entregadas, con fecha objetivo y fecha real), no todas. */
    totalOC: number;
    aTiempo: number;
    tardias: number;
    porcentaje: number;
  }[];
  adherenciaJerarquia: {
    jerarquia: string;
    licitaciones: number;
    itemsDentro: number;
    itemsFuera: number;
    porcentaje: number;
  }[];
  proveedoresOpciones: OpcionProveedor[];
  jerarquiasOpciones: string[];
  familiasOpciones: string[];
  productosOpciones: OpcionProducto[];
  hayProductosSinFamilia: boolean;
  /**
   * Números de licitación que entran en los indicadores pero NO tienen tipo de
   * cambio capturado para alguna de sus monedas. Sus importes se están sumando
   * como MXN (tasa 1) y el total queda sub-reportado — el UI debe avisarlo.
   */
  avisoTiposCambio: string[];
  periodo: { startDate: string; endDate: string };
};
