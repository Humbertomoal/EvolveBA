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
 * vuelve a renderizar la plantilla). `tipo` se recibe solo para futura
 * auditoría/logging, no afecta el contenido enviado.
 */
export async function enviarCorreoAction({
  tipo,
  para,
  asunto,
  cuerpo,
  codigoCliente,
  adjuntos,
}: {
  tipo: TipoCorreo;
  para: string;
  asunto: string;
  cuerpo: string;
  codigoCliente: string;
  adjuntos?: AdjuntoCorreo[];
}): Promise<ResultadoEnvioCorreo> {
  const session = await auth();
  if (!session) {
    return { exito: false, error: "No autorizado" };
  }

  if (!para || !asunto.trim() || !cuerpo.trim()) {
    return { exito: false, error: "Faltan datos para enviar el correo" };
  }

  try {
    const cuerpoHtml = convertirTextoAHtml(cuerpo, codigoCliente);
    return await enviarCorreo({ para, asunto, cuerpoHtml, adjuntos });
  } catch (error) {
    return {
      exito: false,
      error:
        error instanceof Error ? error.message : "Error desconocido al enviar el correo",
    };
  }
}

