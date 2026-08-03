import type { ResumenAhorroCalculado } from "./licitacionesAhorro";

/**
 * Estado intermedio entre "Cerrada" y "Finalizada": el comprador ya confirmó
 * ganadores y les mandó la asignación PRELIMINAR, y se espera a que cada
 * proveedor valide fechas y cantidad en su portal.
 *
 * Vive aquí (módulo puro, sin Prisma) y no en estadoLog.ts a propósito: lo
 * consumen tanto server components/actions como componentes cliente (el badge
 * de SeleccionTabla), y estadoLog.ts es server-only porque importa Prisma.
 *
 * Al agregarlo o quitarlo hay que revisar TODOS los filtros por estado: el
 * listado de Selección (aquí y en seleccionActions), el portal del proveedor
 * (listado y detalle) y el badge. Si falta en alguno, la licitación desaparece
 * de esa vista a media transición.
 */
export const ESTADO_ESPERANDO_VALIDACION = "Esperando Validación";

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
