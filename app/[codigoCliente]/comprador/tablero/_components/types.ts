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
    productoNombre: string;
    familia: string | null;
    cantidadTotal: number;
    precioObjetivoPromedio: number;
    precioAdjudicadoPromedio: number;
    ahorroTotal: number;
  }[];
  onTimeProveedor: {
    proveedorNombre: string;
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
  proveedoresOpciones: { id: string; nombre: string }[];
  jerarquiasOpciones: string[];
  periodo: { startDate: string; endDate: string };
};

export type FiltrosActivos = {
  period: string;
  proveedorId: string;
  jerarquia: string;
  dateFrom: string;
  dateTo: string;
};
