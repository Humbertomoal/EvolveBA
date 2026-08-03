import type { TiposCambio } from "@/src/lib/conversionMoneda";

export type OfertaParaDropdown = {
  proveedorId: string;
  proveedorNombre: string;
  precioUnitario: number;
  cantidadDisponible: number;
  ronda: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
};

export type ItemParaAsignacion = {
  licitacionItemId: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadSolicitada: number;
  fechaEntrega: string | null;
  moneda: string;
  ofertas: OfertaParaDropdown[];
};

export type AsignacionDetalle = {
  id: string;
  licitacionItemId: string;
  productoNombre: string;
  unidadMedida: string;
  // Cantidad pedida del material (de LicitacionItem). Referencia para el modal
  // de edición y para avisar si la suma asignada deja de cuadrar.
  cantidadSolicitada: number;
  moneda: string;
  proveedorId: string;
  proveedorNombre: string;
  cantidadAsignada: number;
  precioUnitario: number;
  ronda: number;
  orden: number;
  fechaObjetivo: string | null;
  fechaEstimadaProveedor: string | null;
  estatusProveedor: string;
  fechaLimiteConfirmacion: string | null;
  motivoRechazo: string | null;
  ofertasAlternativas: OfertaParaDropdown[];
  ordenNumero: string | null;
};

export type LicitacionInfo = {
  id: string;
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  tiempoConfirmacionHoras: number;
  importeVenta: number | null;
  costoObjetivo: number | null;
  estado: string;
  // Tipos de cambio congelados (respecto a MXN) para convertir totales.
  tiposCambio: TiposCambio;
  // Moneda en la que se consolidan los totales (default MXN).
  monedaConsolidacion: string;
};
