"use server";

import type { AdjuntoCorreo } from "@/src/lib/emailService";

/**
 * Presupuesto de adjuntos por CORREO, en bytes crudos (antes de base64, que
 * infla ~33%). Microsoft Graph acepta ~4 MB de payload en sendMail con
 * adjuntos inline; por encima haría falta una upload session. 3 MB crudos
 * ≈ 4 MB en base64, así que este tope es el techo práctico de Graph.
 */
const LIMITE_BYTES_ADJUNTOS = 3 * 1024 * 1024;

function nombreDesdeUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ultimo = pathname.split("/").pop() ?? "archivo";
    return decodeURIComponent(ultimo);
  } catch {
    return "archivo";
  }
}

type ArchivoDescargado = { adjunto: AdjuntoCorreo; bytes: number };

/**
 * Descarga una URL pública a base64. Devuelve null si falla (se loguea): un
 * archivo caído nunca debe tumbar el correo completo.
 */
async function descargar(url: string): Promise<ArchivoDescargado | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`No se pudo descargar el adjunto (${response.status}):`, url);
      return null;
    }
    const buffer = await response.arrayBuffer();
    return {
      bytes: buffer.byteLength,
      adjunto: {
        nombre: nombreDesdeUrl(url),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
        contenidoBase64: Buffer.from(buffer).toString("base64"),
        url,
      },
    };
  } catch (error) {
    console.error("Error descargando adjunto para correo:", url, error);
    return null;
  }
}

/** Descarga un conjunto de URLs UNA sola vez cada una (varios destinatarios comparten archivos). */
async function descargarUnicas(urls: string[]): Promise<Map<string, ArchivoDescargado>> {
  const unicas = [...new Set(urls.filter(Boolean))];
  const cache = new Map<string, ArchivoDescargado>();
  const resultados = await Promise.all(unicas.map((url) => descargar(url)));
  unicas.forEach((url, i) => {
    const r = resultados[i];
    if (r) cache.set(url, r);
  });
  return cache;
}

export type AdjuntosInvitacion = {
  /** Documentos de la licitación: van a TODOS los destinatarios. */
  adjuntosComunes: AdjuntoCorreo[];
  /** correo → fichas técnicas de SUS materiales que cupieron en el presupuesto. */
  adjuntosPorDestinatario: Record<string, AdjuntoCorreo[]>;
  /** correo → URLs que NO cupieron; el llamador las manda como enlaces de descarga. */
  enlacesPorDestinatario: Record<string, string[]>;
  /** Documentos de licitación que no cupieron ni siquiera antes de las fichas. */
  documentosOmitidos: string[];
};

/**
 * Arma los adjuntos del correo de invitación con presupuesto POR DESTINATARIO.
 *
 * Reglas de recorte (en este orden):
 *   1. Documentos de la licitación — nunca se sacrifican por una ficha.
 *   2. Fichas técnicas del proveedor, en orden de aparición de sus materiales.
 * Lo que no cabe NO se descarta en silencio: vuelve en `enlacesPorDestinatario`
 * para ofrecerlo como enlace de descarga (las URLs de Storage son públicas).
 *
 * El recorte es POR ARCHIVO, no todo-o-nada: si una ficha grande no cabe, se
 * siguen probando las siguientes (una más chica sí puede entrar). Antes, pasarse
 * del tope descartaba TODOS los adjuntos, incluidos los documentos de la
 * licitación que hoy sí llegan.
 *
 * Cada URL se descarga una sola vez aunque la compartan varios destinatarios.
 * Nunca lanza.
 */
export async function prepararAdjuntosInvitacionAction({
  documentosLicitacion,
  fichasPorDestinatario,
}: {
  documentosLicitacion: string[];
  fichasPorDestinatario: Record<string, string[]>;
}): Promise<AdjuntosInvitacion> {
  const todasLasFichas = Object.values(fichasPorDestinatario).flat();
  const cache = await descargarUnicas([...documentosLicitacion, ...todasLasFichas]);

  // ── 1. Documentos comunes ───────────────────────────────────────────────────
  // Se procesan primero y son iguales para todos, así que el subconjunto que
  // cabe es idéntico para cada destinatario.
  const adjuntosComunes: AdjuntoCorreo[] = [];
  const documentosOmitidos: string[] = [];
  let bytesComunes = 0;

  for (const url of documentosLicitacion) {
    const archivo = cache.get(url);
    if (!archivo) {
      documentosOmitidos.push(url);
      continue;
    }
    if (bytesComunes + archivo.bytes > LIMITE_BYTES_ADJUNTOS) {
      documentosOmitidos.push(url);
      continue;
    }
    bytesComunes += archivo.bytes;
    adjuntosComunes.push(archivo.adjunto);
  }

  // ── 2. Fichas por destinatario, con lo que quede del presupuesto ────────────
  const adjuntosPorDestinatario: Record<string, AdjuntoCorreo[]> = {};
  const enlacesPorDestinatario: Record<string, string[]> = {};

  for (const [correo, urls] of Object.entries(fichasPorDestinatario)) {
    const propios: AdjuntoCorreo[] = [];
    const enlaces: string[] = [];
    let bytes = bytesComunes;

    for (const url of urls) {
      const archivo = cache.get(url);
      if (!archivo) {
        // No se pudo descargar: al menos que le llegue el enlace.
        enlaces.push(url);
        continue;
      }
      if (bytes + archivo.bytes > LIMITE_BYTES_ADJUNTOS) {
        enlaces.push(url);
        continue;
      }
      bytes += archivo.bytes;
      propios.push(archivo.adjunto);
    }

    adjuntosPorDestinatario[correo] = propios;
    enlacesPorDestinatario[correo] = enlaces;
  }

  return {
    adjuntosComunes,
    adjuntosPorDestinatario,
    enlacesPorDestinatario,
    documentosOmitidos,
  };
}
