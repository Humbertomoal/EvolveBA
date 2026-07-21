/**
 * Generación de código de producto: {INICIALES_FAMILIA}-{INICIALES_DESCRIPCION}-{NNN}
 * (ej. TI-PBI-001). Solo funciones puras — sin Prisma — para que sea seguro
 * importar este archivo desde un Client Component. La consulta a BD del
 * consecutivo vive en productos.ts.
 */

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function limpiarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toUpperCase();
}

function obtenerPalabras(texto: string): string[] {
  return limpiarTexto(texto)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** 2-3 letras. Una palabra → primeras 3 letras. Varias → inicial de cada una (máx 3). */
export function inicialesFamilia(familia: string): string {
  const palabras = obtenerPalabras(familia).slice(0, 3);
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].slice(0, 3);
  return palabras.map((p) => p[0]).join("");
}

/**
 * Siempre 3 letras. Una palabra → primeras 3. Varias → inicial de cada
 * palabra salvo la última, que aporta las letras que falten para llegar a 3
 * (ej. "Power BI" → P + BI = PBI, "Power Automate" → P + AU = PAU).
 */
export function inicialesDescripcion(nombre: string): string {
  const LONGITUD = 3;
  const palabras = obtenerPalabras(nombre);
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].slice(0, LONGITUD);

  const base = palabras
    .slice(0, -1)
    .map((p) => p[0])
    .join("")
    .slice(0, LONGITUD);
  const faltan = LONGITUD - base.length;
  if (faltan <= 0) return base;

  const ultima = palabras[palabras.length - 1];
  return base + ultima.slice(0, faltan);
}

export function formatearConsecutivo(n: number): string {
  return String(n).padStart(3, "0");
}

/** Prefijo sin consecutivo, ej. "TI-PBI". Puede quedar de un solo tramo si falta familia o nombre. */
export function construirPrefijoCodigo(familia: string, nombre: string): string {
  const fam = inicialesFamilia(familia);
  const desc = inicialesDescripcion(nombre);
  return [fam, desc].filter(Boolean).join("-");
}

/** Código completo con un consecutivo ya calculado. "" si no hay datos suficientes. */
export function construirCodigo(
  familia: string,
  nombre: string,
  consecutivo: number
): string {
  const prefijo = construirPrefijoCodigo(familia, nombre);
  if (!prefijo) return "";
  return `${prefijo}-${formatearConsecutivo(consecutivo)}`;
}

/** Extrae el consecutivo (últimos 3 dígitos) de un código existente, o null si no aplica. */
export function extraerConsecutivo(codigo: string): number | null {
  const match = codigo.match(/-(\d{3})$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}
