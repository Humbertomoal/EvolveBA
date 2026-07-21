import { getConfigEmpresa } from "@/src/config/empresa";
import { plantillasCorreo, type TipoCorreo } from "@/src/config/plantillasCorreo";
import { formatFechaMexico } from "@/src/lib/dateUtils";
import { formatImporte } from "@/src/lib/monedas";

export type { TipoCorreo };

/**
 * Variables disponibles en TODOS los tipos de correo, se llenan
 * automáticamente desde getConfigEmpresa(codigoCliente) — no hace
 * falta pasarlas en `variables`.
 */
export const VARIABLES_COMUNES = [
  "nombreEmpresa",
  "nombreComercial",
  "nombreAsistente",
  "tituloAsistente",
  "telefonoContacto",
  "urlPortal",
  "firmaCorreo",
] as const;

/**
 * Variables específicas por tipo de correo (además de las comunes).
 * Estas SÍ hay que pasarlas explícitamente en `variables` al llamar
 * a renderizarPlantilla — vienen del proveedor/licitación/resultado
 * involucrado en cada envío, no de la config de empresa. La lista de
 * cada tipo refleja exactamente los {placeholders} que aparecen en su
 * plantilla (src/config/plantillasCorreo.ts).
 *
 * Grupos de origen:
 * - Proveedor:   nombreProveedor, nombreContacto, usuarioAcceso, passwordTemporal
 * - Licitación:  numeroLicitacion, nombreComprador, correoComprador,
 *                telefonoComprador, fechaInicio, fechaFin, fechaAnterior,
 *                cantidadMateriales, tablaMateriales, instruccionesLicitacion
 * - Resultado:   tablaGanadores, ahorroTotal, presupuestoObjetivo,
 *                totalPrimeraRonda, mejorCostoTotal, adherenciaPrecio
 */
export const VARIABLES_POR_TIPO: Record<TipoCorreo, readonly string[]> = {
  ALTA_PROVEEDOR: ["nombreContacto", "usuarioAcceso", "passwordTemporal"],
  RECORDATORIO_PRODUCTOS: ["nombreContacto", "usuarioAcceso", "passwordTemporal"],
  INVITACION_LICITACION: [
    "numeroLicitacion",
    "fechaInicio",
    "fechaFin",
    "cantidadMateriales",
    "tablaMateriales",
    "instruccionesLicitacion",
    "nombreComprador",
    "telefonoComprador",
    "correoComprador",
  ],
  CAMBIO_FECHA: [
    "numeroLicitacion",
    "fechaAnterior",
    "fechaInicio",
    "nombreComprador",
    "telefonoComprador",
    "correoComprador",
  ],
  RESULTADO_INTERNO: [
    "numeroLicitacion",
    "nombreComprador",
    "presupuestoObjetivo",
    "totalPrimeraRonda",
    "mejorCostoTotal",
    "adherenciaPrecio",
    "ahorroTotal",
    "tablaGanadores",
  ],
  NOTIFICACION_GANADORES: ["nombreProveedor", "numeroLicitacion", "tablaMateriales"],
  NOTIFICACION_NO_GANADORES: ["nombreProveedor", "numeroLicitacion"],
  CONFIRMACION_CIERRE: [
    "nombreProveedor",
    "numeroLicitacion",
    "tablaMateriales",
    "nombreComprador",
    "telefonoComprador",
    "correoComprador",
  ],
};

/** Variables válidas para un tipo de correo: comunes + específicas. */
export function listarVariablesDisponibles(tipo: TipoCorreo): string[] {
  return [...VARIABLES_COMUNES, ...VARIABLES_POR_TIPO[tipo]];
}

/**
 * Firma estándar (nombreAsistente, tituloAsistente, nombreEmpresa) ya
 * renderizada — para anteponerla en correos libres que no parten de una
 * plantilla (ver ModalCorreo en modo libre).
 */
export function renderizarFirma(codigoCliente: string): string {
  const empresa = getConfigEmpresa(codigoCliente);
  return `${empresa.nombreAsistente}\n${empresa.tituloAsistente} - ${empresa.nombreEmpresa}`;
}

function reemplazarVariables(
  texto: string,
  variables: Record<string, string>
): string {
  return texto.replace(/\{(\w+)\}/g, (_match, nombre: string) => {
    return variables[nombre] ?? "";
  });
}

/**
 * Renderiza una plantilla de correo: combina las variables comunes
 * (tomadas de getConfigEmpresa) con las variables específicas dadas,
 * y reemplaza todos los {placeholders} en asunto y cuerpo. Cualquier
 * variable sin valor se deja vacía (nunca queda el {placeholder} crudo).
 */
export function renderizarPlantilla(
  tipo: TipoCorreo,
  variables: Record<string, string>,
  codigoCliente: string
): { asunto: string; cuerpo: string } {
  const plantilla = plantillasCorreo[tipo];
  const empresa = getConfigEmpresa(codigoCliente);

  const variablesComunes: Record<string, string> = {
    nombreEmpresa: empresa.nombreEmpresa,
    nombreComercial: empresa.nombreComercial,
    nombreAsistente: empresa.nombreAsistente,
    tituloAsistente: empresa.tituloAsistente,
    telefonoContacto: empresa.telefonoContacto,
    urlPortal: empresa.urlPortal,
    firmaCorreo: empresa.firmaCorreo,
  };

  const todasLasVariables = { ...variablesComunes, ...variables };

  return {
    asunto: reemplazarVariables(plantilla.asunto, todasLasVariables),
    cuerpo: reemplazarVariables(plantilla.cuerpo, todasLasVariables),
  };
}

// ── Tablas en texto plano para {tablaMateriales} / {tablaGanadores} ────────────
// Formato de lista (no tabla HTML): se ve limpio tanto en texto plano como
// una vez pasado por convertirTextoAHtml (saltos de línea → <br>).

export type ItemTablaMaterial = {
  producto: string;
  cantidad: number;
  unidad: string;
  fechaRequerida: Date | string | null;
};

export function generarTablaMateriales(items: ItemTablaMaterial[]): string {
  if (items.length === 0) return "Sin materiales.";
  return items
    .map(
      (item) =>
        `- ${item.producto}: ${item.cantidad.toLocaleString("es-MX")} ${item.unidad} · Fecha requerida: ${formatFechaMexico(item.fechaRequerida)}`
    )
    .join("\n");
}

export type ItemTablaGanador = {
  material: string;
  proveedor: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  moneda: string;
};

export function generarTablaGanadores(asignaciones: ItemTablaGanador[]): string {
  if (asignaciones.length === 0) return "Sin asignaciones.";
  return asignaciones
    .map((a) => {
      const subtotal = a.cantidad * a.precioUnitario;
      return `- ${a.material} → ${a.proveedor} · ${a.cantidad.toLocaleString("es-MX")} ${a.unidad} × ${formatImporte(a.precioUnitario, a.moneda)} = ${formatImporte(subtotal, a.moneda)}`;
    })
    .join("\n");
}
