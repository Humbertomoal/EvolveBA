import { getConfigEmpresa } from "@/src/config/empresa";
import { plantillasCorreo, type TipoCorreo } from "@/src/config/plantillasCorreo";

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
 * involucrado en cada envío, no de la config de empresa.
 *
 * Grupos de origen:
 * - Proveedor:   nombreProveedor, nombreContacto, usuarioAcceso, passwordTemporal
 * - Licitación:  numeroLicitacion, nombreComprador, correoComprador,
 *                telefonoComprador, fechaInicio, fechaFin, tablaMateriales
 * - Resultado:   tablaGanadores, ahorroTotal, excelAdjunto
 */
export const VARIABLES_POR_TIPO: Record<TipoCorreo, readonly string[]> = {
  ALTA_PROVEEDOR: [
    "nombreProveedor",
    "nombreContacto",
    "usuarioAcceso",
    "passwordTemporal",
  ],
  RECORDATORIO_PRODUCTOS: ["nombreProveedor", "nombreContacto"],
  INVITACION_LICITACION: [
    "nombreProveedor",
    "nombreContacto",
    "numeroLicitacion",
    "nombreComprador",
    "correoComprador",
    "telefonoComprador",
    "fechaInicio",
    "fechaFin",
    "tablaMateriales",
  ],
  CAMBIO_FECHA: [
    "nombreProveedor",
    "nombreContacto",
    "numeroLicitacion",
    "nombreComprador",
    "fechaInicio",
    "fechaFin",
  ],
  RESULTADO_INTERNO: [
    "numeroLicitacion",
    "nombreComprador",
    "tablaGanadores",
    "ahorroTotal",
    "excelAdjunto",
  ],
  NOTIFICACION_GANADORES: [
    "nombreProveedor",
    "nombreContacto",
    "numeroLicitacion",
    "nombreComprador",
    "correoComprador",
    "telefonoComprador",
    "tablaMateriales",
  ],
  CONFIRMACION_CIERRE: [
    "numeroLicitacion",
    "nombreComprador",
    "ahorroTotal",
    "excelAdjunto",
  ],
};

/** Variables válidas para un tipo de correo: comunes + específicas. */
export function listarVariablesDisponibles(tipo: TipoCorreo): string[] {
  return [...VARIABLES_COMUNES, ...VARIABLES_POR_TIPO[tipo]];
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
