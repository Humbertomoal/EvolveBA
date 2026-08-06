import type {
  FiltrosTablero,
  OpcionProducto,
  OpcionProveedor,
} from "@/src/lib/tableroFiltros";
import type { FilaPareto } from "@/src/lib/tableroHistorico";

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
  // NOTA: la gráfica "Ahorro por material" de Fase 0 se retiró. Su dato vive
  // ahora en historico.ahorroPorProducto (Pareto, con periodo propio) — una
  // sola vista del mismo número, en vez de dos con ventanas distintas.

  /**
   * Grupo 3 — análisis histórico. Cada indicador tiene su PROPIA ventana; el
   * filtro global de periodo no aplica aquí (los de familia/producto/proveedor
   * sí). Todos los montos en MXN con el TC congelado de cada licitación.
   */
  historico: {
    /** Aditivos → Pareto válido (barras + % acumulado). */
    ahorroPorProducto: FilaPareto[];
    montoPorProveedor: FilaPareto[];
    /** Los 3 proveedores con MEJOR precio unitario promedio del producto elegido. */
    top3Proveedores: {
      proveedorId: string;
      proveedorNombre: string;
      precioPromedio: number;
      cantidad: number;
    }[];
    /**
     * Ranking simple, SIN acumulado: los precios unitarios no son aditivos
     * entre productos (y cada uno trae su propia unidad de medida).
     */
    costoUnitario: {
      productoId: string;
      etiqueta: string;
      unidad: string;
      precioPromedio: number;
    }[];
    variacionPrecio: {
      mes: string;
      etiqueta: string;
      precioPromedio: number | null;
      cantidad: number;
    }[];
    /** Productos con compras en la ventana más ancha, para los selectores. */
    productosOpciones: { id: string; codigo: string; nombre: string }[];
    /** Producto efectivamente graficado (elegido, prefiltrado o forzado). */
    productoTop3: string;
    productoVariacion: string;
    /** true si el filtro global de producto está fijando #3 y #5. */
    productoBloqueado: boolean;
    /** true si el filtro global de proveedor deja el Pareto en una sola barra. */
    proveedorFiltrado: boolean;
  };
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
