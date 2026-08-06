// ─────────────────────────────────────────────────────────────────────────────
// Resumen de la respuesta de un proveedor a su asignación — lógica PURA.
//
// Arma las tablas de materiales aceptados y rechazados que van en el correo
// RESPUESTA_PROVEEDOR. Sin Prisma: recibe formas mínimas y devuelve texto, para
// poder probarse y reutilizarse sin arrastrar el cliente de base de datos.
//
// Los importes ya llegan CONVERTIDOS por el call site, que es quien tiene los
// tipos de cambio congelados de la licitación.
// ─────────────────────────────────────────────────────────────────────────────

/** Estatus que representan una respuesta afirmativa del proveedor. */
const ESTATUS_ACEPTADOS = ["Aprobado", "Confirmado"];

/** Estatus que aún no tiene respuesta: mientras exista uno, no se puede cerrar. */
export const ESTATUS_PENDIENTE = "Pendiente";
export const ESTATUS_RECHAZADO = "Rechazado";

export type MaterialRespondido = {
  productoNombre: string;
  unidadMedida: string;
  cantidadAsignada: number;
  estatusProveedor: string;
  motivoRechazo: string | null;
  /**
   * Fecha del rechazo YA FORMATEADA por el call site (que es quien conoce la
   * zona horaria de presentación). null en los rechazos anteriores al campo
   * `fechaRechazo`, y en los materiales aceptados.
   */
  fechaRechazoFormateada: string | null;
  /** Importe de la línea, ya en la moneda que se va a mostrar. */
  importeFormateado: string;
};

export function esAceptado(estatus: string): boolean {
  return ESTATUS_ACEPTADOS.includes(estatus);
}

export function esRechazado(estatus: string): boolean {
  return estatus === ESTATUS_RECHAZADO;
}

export function esPendiente(estatus: string): boolean {
  return estatus === ESTATUS_PENDIENTE;
}

function formatCantidad(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

/**
 * Línea de material para el correo. Texto plano con guiones: el cuerpo se
 * convierte después a HTML con convertirTextoAHtml(), que respeta los saltos.
 */
function lineaAceptado(m: MaterialRespondido): string {
  return `  • ${m.productoNombre} — ${formatCantidad(m.cantidadAsignada)} ${m.unidadMedida} — ${m.importeFormateado}`;
}

function lineaRechazado(m: MaterialRespondido): string {
  // El motivo es lo que el comprador necesita para decidir la reasignación,
  // así que va en la misma línea y nunca se omite.
  const motivo = m.motivoRechazo?.trim() || "(sin motivo capturado)";
  // La fecha se omite si no la hay (rechazos previos al campo fechaRechazo),
  // en vez de mostrar un hueco o inventar una.
  const cuando = m.fechaRechazoFormateada ? ` · Rechazado el ${m.fechaRechazoFormateada}` : "";
  return `  • ${m.productoNombre} — ${formatCantidad(m.cantidadAsignada)} ${m.unidadMedida}${cuando}\n    Motivo: ${motivo}`;
}

export type ResumenRespuesta = {
  tablaAceptados: string;
  tablaRechazados: string;
  totalAceptados: number;
  totalRechazados: number;
  /** true si no queda ningún material sin responder. */
  respondioTodo: boolean;
};

export function construirResumenRespuesta(
  materiales: MaterialRespondido[]
): ResumenRespuesta {
  const aceptados = materiales.filter((m) => esAceptado(m.estatusProveedor));
  const rechazados = materiales.filter((m) => esRechazado(m.estatusProveedor));
  const pendientes = materiales.filter((m) => esPendiente(m.estatusProveedor));

  return {
    tablaAceptados:
      aceptados.length > 0
        ? aceptados.map(lineaAceptado).join("\n")
        : "  (ninguno)",
    tablaRechazados:
      rechazados.length > 0
        ? rechazados.map(lineaRechazado).join("\n")
        : "  (ninguno)",
    totalAceptados: aceptados.length,
    totalRechazados: rechazados.length,
    respondioTodo: pendientes.length === 0 && materiales.length > 0,
  };
}
