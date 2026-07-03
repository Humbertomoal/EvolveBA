// Shared types for Ordenes de Compra modules (no "use server")

export const ESTADOS_ACTIVOS = ["Pendiente", "En tránsito", "Entregada"];
export const LIMIT_ORDENES = 25;

export type FiltrosOrdenes = {
  estados: string[];
  periodo: string;    // "" | "semana" | "mes" | "3meses" | "personalizado"
  fechaDesde: string;
  fechaHasta: string;
};

export const FILTROS_ORDENES_DEFAULT: FiltrosOrdenes = {
  estados: ESTADOS_ACTIVOS,
  periodo: "",
  fechaDesde: "",
  fechaHasta: "",
};

export type FiltrosOrdenesComprador = FiltrosOrdenes & {
  licitacionNumero: string;
};

export const FILTROS_COMPRADOR_DEFAULT: FiltrosOrdenesComprador = {
  ...FILTROS_ORDENES_DEFAULT,
  licitacionNumero: "",
};

export type OrdenCompradorRow = {
  id: string;
  numero: string;
  licitacionNumero: string;
  jerarquia: string | null;
  proveedorNombre: string;
  totalLineas: number;
  fechaCreacion: string;
  fechaEstimadaEntrega: string | null;
  estado: string;
};

export type OrdenCompraRow = {
  id: string;
  numero: string;
  licitacionNumero: string;
  jerarquia: string | null;
  fechaCreacion: string;
  fechaEstimadaEntrega: string | null;
  total: number;
  estado: string;
};
