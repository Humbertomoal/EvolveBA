import { getConfigEmpresa } from "@/src/config/empresa";

const EMAIL_SENDER = process.env.EMAIL_SENDER || "humberto.morales@evolveba.com.mx";

// ── Token de Microsoft Graph (Client Credentials / app-only) ───────────────────

type TokenCacheado = { accessToken: string; expiraEn: number };

let tokenCacheado: TokenCacheado | null = null;

/**
 * Obtiene un access token de Microsoft Graph vía Client Credentials
 * (app-only, sin usuario logueado). El token se cachea en memoria del
 * proceso hasta ~1 minuto antes de expirar, para no pedir uno nuevo
 * en cada envío (dura ~1 hora).
 */
export async function obtenerTokenGraph(): Promise<string> {
  const ahora = Date.now();
  if (tokenCacheado && tokenCacheado.expiraEn > ahora + 60_000) {
    return tokenCacheado.accessToken;
  }

  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "";
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "";
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "";

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(
      `No se pudo obtener token de Microsoft Graph (${response.status}): ${detalle}`
    );
  }

  const data = await response.json();
  tokenCacheado = {
    accessToken: data.access_token,
    expiraEn: ahora + data.expires_in * 1000,
  };
  return tokenCacheado.accessToken;
}

// ── Envío de correo vía Microsoft Graph sendMail ────────────────────────────────

export type AdjuntoCorreo = {
  nombre: string;
  contenidoBase64: string;
  contentType: string;
};

export type ResultadoEnvioCorreo = { exito: true } | { exito: false; error: string };

/**
 * Envía un correo usando Microsoft Graph (POST /users/{buzón}/sendMail),
 * autenticado con el token app-only de obtenerTokenGraph(). Nunca lanza:
 * cualquier fallo (token, red, Graph) se captura y se devuelve como
 * { exito: false, error }.
 */
export async function enviarCorreo({
  para,
  asunto,
  cuerpoHtml,
  adjuntos,
}: {
  para: string;
  asunto: string;
  cuerpoHtml: string;
  adjuntos?: AdjuntoCorreo[];
}): Promise<ResultadoEnvioCorreo> {
  try {
    const token = await obtenerTokenGraph();

    const message: Record<string, unknown> = {
      subject: asunto,
      body: { contentType: "HTML", content: cuerpoHtml },
      toRecipients: [{ emailAddress: { address: para } }],
    };

    if (adjuntos && adjuntos.length > 0) {
      message.attachments = adjuntos.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.nombre,
        contentType: a.contentType,
        contentBytes: a.contenidoBase64,
      }));
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${EMAIL_SENDER}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    );

    if (!response.ok) {
      const detalle = await response.text();
      return {
        exito: false,
        error: `Microsoft Graph respondió ${response.status}: ${detalle}`,
      };
    }

    return { exito: true };
  } catch (error) {
    return {
      exito: false,
      error: error instanceof Error ? error.message : "Error desconocido al enviar correo",
    };
  }
}

// ── Texto plano → HTML básico para correo ───────────────────────────────────────

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convierte el cuerpo en texto plano de una plantilla (con saltos de
 * línea) a un HTML básico apto para cualquier cliente de correo: todo
 * con estilos inline, tabla de layout, encabezado con el color primario
 * de la empresa del cliente indicado.
 */
export function convertirTextoAHtml(texto: string, codigoCliente: string): string {
  const empresa = getConfigEmpresa(codigoCliente);

  const contenidoHtml = texto
    .split("\n")
    .map((linea) => (linea.trim() === "" ? "<br>" : `${escapeHtml(linea)}<br>`))
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${empresa.colorPrimario};padding:20px 24px;">
                <span style="color:#ffffff;font-size:16px;font-weight:bold;">${escapeHtml(empresa.nombreComercial)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#333333;font-size:14px;line-height:1.6;">
                ${contenidoHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
