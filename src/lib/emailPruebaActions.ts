"use server";

import { renderizarPlantilla } from "@/src/lib/plantillasCorreo";
import { convertirTextoAHtml, enviarCorreo, type ResultadoEnvioCorreo } from "@/src/lib/emailService";

/**
 * Server Action temporal para validar el envío de correos vía
 * Microsoft Graph. Renderiza la plantilla ALTA_PROVEEDOR con datos
 * de ejemplo y la envía al correo indicado.
 */
export async function enviarCorreoPruebaAction(
  emailDestino: string
): Promise<ResultadoEnvioCorreo> {
  if (!emailDestino || !emailDestino.includes("@")) {
    return { exito: false, error: "Ingresa un correo destino válido" };
  }

  const { asunto, cuerpo } = renderizarPlantilla(
    "ALTA_PROVEEDOR",
    {
      nombreProveedor: "Proveedor de Prueba S.A. de C.V.",
      nombreContacto: "Contacto de Prueba",
      usuarioAcceso: "prueba@proveedor.com",
      passwordTemporal: "Temporal123!",
    },
    "evolve-ba"
  );

  const cuerpoHtml = convertirTextoAHtml(cuerpo, "evolve-ba");

  return enviarCorreo({ para: emailDestino, asunto, cuerpoHtml });
}
