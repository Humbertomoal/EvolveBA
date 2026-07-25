// ─────────────────────────────────────────────────────────────────────────────
// Núcleo de actualización de tipos de cambio desde Banxico — compartido entre
// el Server Action manual (banxicoActions.ts) y el cron de Vercel
// (app/api/cron/actualizar-tipo-cambio/route.ts). NO tiene "use server": es
// lógica reutilizable, no un Server Action.
//
// 100% server-side: BANXICO_TOKEN nunca sale al cliente.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * Monedas que Banxico expone por API, con su serie del SIE.
 * Preparado para multi-moneda: para agregar otra moneda, añade su código y
 * serie aquí (p. ej. si Banxico publicara una serie EUR/MXN). Hoy solo USD:
 * serie SF43718 = tipo de cambio FIX USD/MXN (pesos por dólar).
 */
export const SERIES_BANXICO: Record<string, string> = {
  USD: "SF43718",
};

const BASE_ENDPOINT =
  "https://www.banxico.org.mx/SieAPIRest/service/v1/series";

export type ResultadoBanxico = {
  ok: boolean;
  error?: string;
  /** Código de la moneda actualizada (p. ej. "USD"). */
  codigo?: string;
  /** Tasa a MXN obtenida (pesos por unidad de la moneda). */
  tipoCambio?: number;
  /** Fecha del dato reportado por Banxico (ISO). */
  fechaDato?: string;
  /** Fecha del dato tal como la reporta Banxico ("dd/MM/aaaa"). */
  fechaDatoLabel?: string;
};

export type ResultadoBanxicoLote = {
  ok: boolean;
  /** Un resultado por cada moneda soportada que se intentó actualizar. */
  resultados: ResultadoBanxico[];
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
 * Actualiza el tipo de cambio de UNA moneda soportada por Banxico y lo guarda
 * en su CatalogoValor (tipoCambio + tipoCambioActualizado = fecha del dato de
 * Banxico). Nunca lanza — ante cualquier fallo devuelve { ok:false, error }.
 *
 * @param revalidar si true, invalida el cache tras guardar (para que Settings
 *   muestre el nuevo valor). El cron lo deja en true igual que el botón manual.
 */
export async function actualizarMonedaDesdeBanxico(
  clienteId: string,
  codigo: string,
  revalidar: boolean = true
): Promise<ResultadoBanxico> {
  const serie = SERIES_BANXICO[codigo];
  if (!serie) {
    return { ok: false, codigo, error: `Banxico no tiene serie para ${codigo}.` };
  }

  const token = process.env.BANXICO_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      codigo,
      error:
        "Banxico no está configurado (falta BANXICO_TOKEN). Captura el tipo de cambio manualmente.",
    };
  }

  // La fila de la moneda debe existir en el catálogo para guardar la tasa.
  let fila: any;
  try {
    fila = await db.catalogoValor.findFirst({
      where: { tipo: "MONEDA", codigo, clienteId },
    });
  } catch {
    return { ok: false, codigo, error: "No se pudo leer el catálogo de monedas." };
  }
  if (!fila) {
    return { ok: false, codigo, error: `No existe la moneda ${codigo} en el catálogo.` };
  }

  // Llamada a Banxico con timeout — que un cuelgue no bloquee el request.
  let json: any;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${BASE_ENDPOINT}/${serie}/datos/oportuno`, {
      headers: { "Bmx-Token": token, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return {
        ok: false,
        codigo,
        error: `Banxico respondió con error (${res.status}). Intenta más tarde o captura la tasa manualmente.`,
      };
    }
    json = await res.json();
  } catch {
    return {
      ok: false,
      codigo,
      error: "No se pudo conectar con Banxico. Intenta más tarde o captura la tasa manualmente.",
    };
  }

  // Estructura: { bmx: { series: [ { datos: [ { fecha, dato } ] } ] } }
  const datos = json?.bmx?.series?.[0]?.datos;
  const ultimo = Array.isArray(datos) && datos.length > 0 ? datos[datos.length - 1] : null;
  const tipoCambio = ultimo ? Number(String(ultimo.dato).replace(/,/g, "")) : NaN;
  if (!ultimo || !Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    return { ok: false, codigo, error: "Banxico no devolvió un tipo de cambio válido." };
  }

  const fechaDato = parsearFechaBanxico(String(ultimo.fecha)) ?? new Date();

  try {
    await db.catalogoValor.update({
      where: { id: fila.id },
      data: { tipoCambio, tipoCambioActualizado: fechaDato },
    });
    if (revalidar) revalidatePath("/", "layout");
  } catch {
    return { ok: false, codigo, error: "Se obtuvo la tasa pero no se pudo guardar. Intenta de nuevo." };
  }

  return {
    ok: true,
    codigo,
    tipoCambio,
    fechaDato: fechaDato.toISOString(),
    fechaDatoLabel: String(ultimo.fecha),
  };
}

/**
 * Actualiza TODAS las monedas soportadas por Banxico (hoy solo USD). Pensado
 * para el cron: recorre `SERIES_BANXICO` y agrega los resultados. `ok` es true
 * solo si todas las monedas se actualizaron correctamente.
 */
export async function actualizarTiposCambioDesdeBanxico(
  clienteId: string = "default"
): Promise<ResultadoBanxicoLote> {
  const resultados: ResultadoBanxico[] = [];
  for (const codigo of Object.keys(SERIES_BANXICO)) {
    resultados.push(await actualizarMonedaDesdeBanxico(clienteId, codigo));
  }
  return { ok: resultados.length > 0 && resultados.every((r) => r.ok), resultados };
}
