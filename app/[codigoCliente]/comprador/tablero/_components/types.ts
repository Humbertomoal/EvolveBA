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
    ahorroTotal: number;
    adherenciaPrecios: number | null;
    onTimeDelivery: number | null;
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
