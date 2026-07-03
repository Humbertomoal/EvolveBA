export type FiltrosFinalizadas = {
  estados: string[];              // checkboxes: ["Finalizada"] default
  fechaCreacionVentana: string;   // select: "mes" default
  fechaCreacionDesde: string;
  fechaCreacionHasta: string;
  fechaInicioVentana: string;     // select: "" = sin filtrar
  fechaInicioDesde: string;
  fechaInicioHasta: string;
  fechaFinVentana: string;        // select: "" = sin filtrar
  fechaFinDesde: string;
  fechaFinHasta: string;
  jerarquia: string;              // select: "" = Todas
};

export const FILTROS_DEFAULT: FiltrosFinalizadas = {
  estados: ["Finalizada"],
  fechaCreacionVentana: "mes",
  fechaCreacionDesde: "",
  fechaCreacionHasta: "",
  fechaInicioVentana: "",
  fechaInicioDesde: "",
  fechaInicioHasta: "",
  fechaFinVentana: "",
  fechaFinDesde: "",
  fechaFinHasta: "",
  jerarquia: "",
};

export type LicitacionFinalizada = {
  id: string;
  numero: string;
  modoLicitacion: string;
  jerarquia: string | null;
  fechaInicio: string | null;   // fechaInicioLicitacion
  fechaCierre: string | null;   // fechaCerrada
  fechaFin: string | null;      // fechaFinalizada ?? fechaCancelada
  estado: string;
  numItems: number;
  numProveedores: number;
  costoFinal: number;
};
