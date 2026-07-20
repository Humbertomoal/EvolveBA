"use server";

import { auth } from "@/src/auth";
import {
  renderizarPlantilla,
  type TipoCorreo,
} from "@/src/lib/plantillasCorreo";
import {
  convertirTextoAHtml,
  enviarCorreo,
  type AdjuntoCorreo,
  type ResultadoEnvioCorreo,
} from "@/src/lib/emailService";

/**
 * Renderiza la plantilla (asunto + cuerpo con variables reemplazadas) sin
 * enviar nada. Pensado para precargar el modal de vista previa/edición.
 */
export async function previsualizarCorreoAction(
  tipo: TipoCorreo,
  variables: Record<string, string>,
  codigoCliente: string
): Promise<{ asunto: string; cuerpo: string; error?: string }> {
  const session = await auth();
  if (!session) {
    return { asunto: "", cuerpo: "", error: "No autorizado" };
  }

  try {
    const { asunto, cuerpo } = renderizarPlantilla(tipo, variables, codigoCliente);
    return { asunto, cuerpo };
  } catch (error) {
    return {
      asunto: "",
      cuerpo: "",
      error:
        error instanceof Error ? error.message : "No se pudo generar la vista previa",
    };
  }
}

/**
 * Envía un correo ya editado por el usuario (asunto/cuerpo finales, NO se
 * vuelve a renderizar la plantilla completa). `tipo` se recibe solo para
 * futura auditoría/logging, no afecta el contenido enviado.
 *
 * `variablesBase` + `variablesPorDestinatario` permiten personalizar SOLO
 * ciertas variables (p.ej. la tabla de materiales) por destinatario, sin
 * perder las ediciones manuales que el usuario haya hecho al resto del
 * texto: se busca el valor ya renderizado en `variablesBase` dentro de
 * asunto/cuerpo y se reemplaza por el valor específico de ese destinatario
 * en `variablesPorDestinatario[para]`. Si el usuario editó esa parte del
 * texto (el valor base ya no aparece tal cual), el reemplazo simplemente no
 * encuentra coincidencia y el texto editado se respeta tal cual.
 */
export async function enviarCorreoAction({
  tipo,
  para,
  asunto,
  cuerpo,
  codigoCliente,
  adjuntos,
  variablesBase,
  variablesPorDestinatario,
}: {
  tipo: TipoCorreo;
  para: string;
  asunto: string;
  cuerpo: string;
  codigoCliente: string;
  adjuntos?: AdjuntoCorreo[];
  variablesBase?: Record<string, string>;
  variablesPorDestinatario?: Record<string, Record<string, string>>;
}): Promise<ResultadoEnvioCorreo> {
  const session = await auth();
  if (!session) {
    return { exito: false, error: "No autorizado" };
  }

  if (!para || !asunto.trim() || !cuerpo.trim()) {
    return { exito: false, error: "Faltan datos para enviar el correo" };
  }

  let asuntoFinal = asunto;
  let cuerpoFinal = cuerpo;

  const overrides = variablesPorDestinatario?.[para];
  if (overrides && variablesBase) {
    for (const [clave, valorPersonalizado] of Object.entries(overrides)) {
      const valorBase = variablesBase[clave];
      if (!valorBase || valorBase === valorPersonalizado) continue;
      asuntoFinal = asuntoFinal.split(valorBase).join(valorPersonalizado);
      cuerpoFinal = cuerpoFinal.split(valorBase).join(valorPersonalizado);
    }
  }

  try {
    const cuerpoHtml = convertirTextoAHtml(cuerpoFinal, codigoCliente);
    return await enviarCorreo({ para, asunto: asuntoFinal, cuerpoHtml, adjuntos });
  } catch (error) {
    return {
      exito: false,
      error:
        error instanceof Error ? error.message : "Error desconocido al enviar el correo",
    };
  }
}

