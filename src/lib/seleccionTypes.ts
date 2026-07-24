import type { ResumenAhorroCalculado } from "./licitacionesAhorro";

export type FiltrosSeleccion = {
  jerarquia: string;
  fechaCierreVentana: string;
  fechaCierreDesde: string;
  fechaCierreHasta: string;
};

export const FILTROS_SELECCION_DEFAULT: FiltrosSeleccion = {
  jerarquia: "",
  fechaCierreVentana: "mes",
  fechaCierreDesde: "",
  fechaCierreHasta: "",
};

export type LicitacionSeleccion = {
  id: string;
  numero: string;
  tipoLicitacion: string | null;
  fechaEjecucion: string | null;
  jerarquia: string | null;
  estado: string;
  // Conservados para cuando se reactiven las columnas de margen/importe.
  importeVenta: number | null;
  costoObjetivoLicitacion: number | null;
  // costoLicitacion y resumenAhorro vienen CONVERTIDOS A MXN (tipos de cambio
  // congelados de la licitación).
  costoLicitacion: number;
  // Métricas de ahorro — calculadas solo para las licitaciones visibles.
  monedaPredominante: string;
  // Moneda en la que se muestran costoLicitacion y los KPIs de resumenAhorro.
  monedaConsolidacion: string;
  resumenAhorro: ResumenAhorroCalculado;
  // Nota discreta del TC usado o null si todo en la moneda de consolidación; aviso si faltan tasas.
  notaTipoCambio: string | null;
  faltanTiposCambio: boolean;
};
