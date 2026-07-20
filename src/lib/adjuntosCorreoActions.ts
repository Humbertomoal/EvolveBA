"use server";

import type { AdjuntoCorreo } from "@/src/lib/emailService";

const LIMITE_BYTES_ADJUNTOS = 3 * 1024 * 1024; // 3MB

function nombreDesdeUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ultimo = pathname.split("/").pop() ?? "archivo";
    return decodeURIComponent(ultimo);
  } catch {
    return "archivo";
  }
}

/**
 * Descarga archivos de Supabase Storage (u otra URL pública) y los convierte
 * a base64 para adjuntarlos a un correo. Si un archivo individual falla al
 * descargarse, se omite (se loguea) y se continúa con el resto — nunca
 * lanza. Si el total de bytes descargados supera el límite prudente
 * (3MB), se omiten TODOS los adjuntos y se avisa vía `omitidoPorTamano`
 * para que el llamador agregue una nota en el cuerpo del correo.
 */
export async function prepararAdjuntosCorreoAction(
  urls: string[]
): Promise<{ adjuntos: AdjuntoCorreo[]; omitidoPorTamano: boolean }> {
  if (!urls || urls.length === 0) {
    return { adjuntos: [], omitidoPorTamano: false };
  }

  const descargados: AdjuntoCorreo[] = [];
  let totalBytes = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          `No se pudo descargar el adjunto para correo (${response.status}):`,
          url
        );
        continue;
      }
      const buffer = await response.arrayBuffer();
      totalBytes += buffer.byteLength;
      descargados.push({
        nombre: nombreDesdeUrl(url),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
        contenidoBase64: Buffer.from(buffer).toString("base64"),
      });
    } catch (error) {
      console.error("Error descargando adjunto para correo:", url, error);
    }
  }

  if (totalBytes > LIMITE_BYTES_ADJUNTOS) {
    return { adjuntos: [], omitidoPorTamano: true };
  }

  return { adjuntos: descargados, omitidoPorTamano: false };
}
