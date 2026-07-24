"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Serie del tipo de cambio FIX USD/MXN (pesos por dólar) del Banco de México.
const SERIE_FIX_USD = "SF43718";
const ENDPOINT = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_FIX_USD}/datos/oportuno`;

export type ResultadoBanxico = {
  ok: boolean;
  error?: string;
  /** Tasa USD→MXN obtenida (pesos por dólar). */
  tipoCambio?: number;
  /** Fecha del dato reportado por Banxico (ISO). */
  fechaDato?: string;
  /** Fecha del dato tal como la reporta Banxico ("dd/MM/aaaa"). */
  fechaDatoLabel?: string;
};

// "dd/MM/aaaa" (formato Banxico) → Date en hora local. Devuelve null si no parsea.
function parsearFechaBanxico(fecha: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Consulta el tipo de cambio FIX USD/MXN más reciente de Banxico y lo guarda
 * en el CatalogoValor de la moneda USD (tipoCambio + tipoCambioActualizado con
 * la fecha del dato de Banxico). 100% server-side: el token nunca sale al
 * cliente. Nunca lanza — ante cualquier fallo devuelve { ok:false, error } y el
 * campo manual sigue disponible como respaldo.
 */
export async function obtenerTipoCambioBanxico(
  clienteId: string = "default"
): Promise<ResultadoBanxico> {
  const token = process.env.BANXICO_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      error:
        "Banxico no está configurado (falta BANXICO_TOKEN). Captura el tipo de cambio manualmente.",
    };
  }

  // La fila USD debe existir en el catálogo para poder guardar la tasa.
  let usd: any;
  try {
    usd = await db.catalogoValor.findFirst({
      where: { tipo: "MONEDA", codigo: "USD", clienteId },
    });
  } catch {
    return { ok: false, error: "No se pudo leer el catálogo de monedas." };
  }
  if (!usd) {
    return { ok: false, error: "No existe la moneda USD en el catálogo." };
  }

  // Llamada a Banxico con timeout — que un cuelgue no bloquee el request.
  let json: any;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(ENDPOINT, {
      headers: { "Bmx-Token": token, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return {
        ok: false,
        error: `Banxico respondió con error (${res.status}). Intenta más tarde o captura la tasa manualmente.`,
      };
    }
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar con Banxico. Intenta más tarde o captura la tasa manualmente.",
    };
  }

  // Estructura: { bmx: { series: [ { datos: [ { fecha, dato } ] } ] } }
  const datos = json?.bmx?.series?.[0]?.datos;
  const ultimo = Array.isArray(datos) && datos.length > 0 ? datos[datos.length - 1] : null;
  const tipoCambio = ultimo ? Number(String(ultimo.dato).replace(/,/g, "")) : NaN;
  if (!ultimo || !Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    return { ok: false, error: "Banxico no devolvió un tipo de cambio válido." };
  }

  const fechaDato = parsearFechaBanxico(String(ultimo.fecha)) ?? new Date();

  try {
    await db.catalogoValor.update({
      where: { id: usd.id },
      data: { tipoCambio, tipoCambioActualizado: fechaDato },
    });
    revalidatePath("/", "layout");
  } catch {
    return { ok: false, error: "Se obtuvo la tasa pero no se pudo guardar. Intenta de nuevo." };
  }

  return {
    ok: true,
    tipoCambio,
    fechaDato: fechaDato.toISOString(),
    fechaDatoLabel: String(ultimo.fecha),
  };
}
