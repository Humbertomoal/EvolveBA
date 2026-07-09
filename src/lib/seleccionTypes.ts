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
  costoLicitacion: number;
  // Métricas de ahorro — calculadas solo para las licitaciones visibles.
  monedaPredominante: string;
  resumenAhorro: ResumenAhorroCalculado;
};
