// ─────────────────────────────────────────────────────────────────────────────
// Histórico de pujas: tipos compartidos + construcción de la hoja de Excel.
//
// Módulo PURO a propósito (no importa Prisma ni `xlsx`), porque lo consumen
// tanto el cliente (botón "Descargar Excel" de HistoricoPujas.tsx) como el
// servidor (el adjunto del correo RESULTADO_INTERNO). Antes cada uno armaba sus
// columnas por su cuenta y las dos listas ya habían divergido; ahora hay una
// sola definición y los dos exports salen idénticos por construcción.
//
// `xlsx` se recibe por parámetro en vez de importarse: ambos call sites lo
// cargan con import() dinámico y así sigue fuera del bundle inicial del cliente.
// ─────────────────────────────────────────────────────────────────────────────

import { convertirAMXN, tasaDe, type TiposCambio } from "./conversionMoneda";

/**
 * Una puja (OfertaItem) del histórico, ya resuelta y convertida.
 *
 * OJO CON `moneda`: es la del LICITACIONITEM, no la de OfertaItem. La columna
 * `OfertaItem.moneda` está muerta —siempre "MXN", nadie la escribe— y leerla
 * era justo el bug que hacía que un panel de 92.50 USD se mostrara como
 * "$92.50 MXN": la etiqueta decía MXN, así que la conversión nunca se
 * intentaba. Ver la nota del schema en LicitacionItem.
 */
export type FilaHistoricoPuja = {
  ronda: number;
  proveedorId: string;
  proveedorNombre: string;
  productoNombre: string;
  cantidadDisponible: number;
  /** Precio tal como lo cotizó el proveedor, en `moneda`. */
  precioUnitario: number;
  /** Moneda del LicitacionItem — la fuente de verdad. */
  moneda: string;
  /** cantidadDisponible × precioUnitario, en `moneda`. */
  subtotal: number;
  /** `precioUnitario` convertido a MXN con el TC congelado de la licitación. */
  precioUnitarioMXN: number;
  /** `subtotal` convertido a MXN. */
  subtotalMXN: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
  fechaPuja: string;
  /** vs la ronda inmediatamente anterior de ESTE proveedor en ESTE material — null = primera ronda en que pujó (no hay anterior). */
  variacionMonto: number | null;
  variacionPct: number | null;
  /** `variacionMonto` convertido a MXN. null cuando no hay ronda anterior. */
  variacionMontoMXN: number | null;
};

/** Filas + el contexto de conversión que necesitan las vistas para formatear. */
export type HistoricoPujasDatos = {
  filas: FilaHistoricoPuja[];
  /** Tasas congeladas de la licitación (respecto a MXN). */
  tiposCambio: TiposCambio;
};

/**
 * Deriva los campos en MXN de una fila. Único punto donde se convierte el
 * histórico: usa `convertirAMXN` del helper central, sin fórmula propia.
 */
export function conMontosMXN(
  fila: Omit<FilaHistoricoPuja, "precioUnitarioMXN" | "subtotalMXN" | "variacionMontoMXN">,
  tiposCambio: TiposCambio
): FilaHistoricoPuja {
  return {
    ...fila,
    precioUnitarioMXN: convertirAMXN(fila.precioUnitario, fila.moneda, tiposCambio),
    subtotalMXN: convertirAMXN(fila.subtotal, fila.moneda, tiposCambio),
    variacionMontoMXN:
      fila.variacionMonto == null
        ? null
        : convertirAMXN(fila.variacionMonto, fila.moneda, tiposCambio),
  };
}

// ── Excel ────────────────────────────────────────────────────────────────────

const FORMATO_MONTO = "#,##0.00";
// El valor ya viene como porcentaje (-8.5), así que el formato solo PEGA el
// símbolo. Con "0.0%" Excel multiplicaría por 100 y saldría -850%.
const FORMATO_PORCENTAJE = '0.0"%"';
const FORMATO_TASA = "#,##0.0000";
const FORMATO_CANTIDAD = "#,##0.##";
const FORMATO_FECHA = "dd/mm/yyyy";
const FORMATO_FECHA_HORA = "dd/mm/yyyy hh:mm";

/**
 * Formato de número por ENCABEZADO, no por posición: la columna "Proveedor"
 * aparece solo en el modo "todos los proveedores", así que los índices se
 * recorren y un mapa posicional se desalinearía en silencio.
 */
const FORMATO_POR_COLUMNA: Record<string, string> = {
  "Cantidad ofertada": FORMATO_CANTIDAD,
  "Precio Unit. Original": FORMATO_MONTO,
  "Precio Unit. MXN": FORMATO_MONTO,
  "Subtotal Original": FORMATO_MONTO,
  "Subtotal MXN": FORMATO_MONTO,
  "Variación MXN": FORMATO_MONTO,
  "Variación %": FORMATO_PORCENTAJE,
  "TC aplicado": FORMATO_TASA,
  "Fecha estimada de entrega": FORMATO_FECHA,
  "Fecha/hora de la puja": FORMATO_FECHA_HORA,
};

/**
 * Excel guarda las fechas como número de serie SIN zona horaria: la celda
 * muestra el valor tal cual, como "hora de pared". Si se escribiera el instante
 * UTC, una puja de las 14:30 de México aparecería como 20:30. Se resta el
 * desfase de México (UTC-6 fijo; no hay horario de verano desde 2022) para que
 * la celda coincida con lo que se ve en pantalla.
 */
function fechaExcelMexico(iso: string | null): Date | null {
  if (!iso) return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  return new Date(instante.getTime() - 6 * 60 * 60 * 1000);
}

type ValorCelda = string | number | Date | null;

/**
 * Arma las filas del Excel. TODO monto va como número puro y la moneda viaja en
 * su propia columna: un "$95.63 MXN" de texto no se puede sumar, filtrar ni
 * meter en una tabla dinámica, que es justo para lo que se exporta esto.
 *
 * Las columnas "Original" y "MXN" van SIEMPRE llenas, también en items que ya
 * eran MXN (donde valen lo mismo). Dejarlas vacías obligaría a filtrar antes de
 * sumar; así cada columna se suma completa de un jalón.
 */
export function construirFilasExcel(
  filas: readonly FilaHistoricoPuja[],
  tiposCambio: TiposCambio,
  opciones: { incluirProveedor: boolean }
): Record<string, ValorCelda>[] {
  return filas.map((f) => ({
    // Número, no "R5": como texto no se ordena ni se filtra por rango.
    Ronda: f.ronda,
    ...(opciones.incluirProveedor ? { Proveedor: f.proveedorNombre } : {}),
    Material: f.productoNombre,
    "Cantidad ofertada": f.cantidadDisponible,
    Moneda: f.moneda,
    "Precio Unit. Original": f.precioUnitario,
    "Precio Unit. MXN": f.precioUnitarioMXN,
    "Subtotal Original": f.subtotal,
    "Subtotal MXN": f.subtotalMXN,
    // null en la primera ronda del grupo: json_to_sheet no escribe celda, y una
    // celda vacía es lo correcto —PROMEDIO y SUMA la ignoran, un 0 no.
    "Variación MXN": f.variacionMontoMXN,
    "Variación %": f.variacionPct,
    "TC aplicado": tasaDe(f.moneda, tiposCambio),
    "¿Cumple fecha?": f.puedeCumplirFecha ? "Sí" : "No",
    "Fecha estimada de entrega": fechaExcelMexico(f.fechaEstimadaEntrega),
    "Fecha/hora de la puja": fechaExcelMexico(f.fechaPuja),
  }));
}

/** Subconjunto de `xlsx` que se usa aquí; evita importar el módulo completo. */
type ModuloXLSX = typeof import("xlsx");

/**
 * Hoja lista para escribir. Las celdas numéricas quedan como número REAL
 * (t:'n') con formato de presentación en `z` — verificado contra xlsx 0.18.5,
 * que sí persiste `z` en la community edition (los estilos son otra historia).
 */
export function construirHojaHistorico(
  XLSX: ModuloXLSX,
  filas: readonly FilaHistoricoPuja[],
  tiposCambio: TiposCambio,
  opciones: { incluirProveedor: boolean }
) {
  const filasExcel = construirFilasExcel(filas, tiposCambio, opciones);
  const hoja = XLSX.utils.json_to_sheet(filasExcel, { cellDates: true });

  const referencia = hoja["!ref"];
  if (!referencia) return hoja;
  const rango = XLSX.utils.decode_range(referencia);

  for (let columna = rango.s.c; columna <= rango.e.c; columna++) {
    const encabezado = hoja[XLSX.utils.encode_cell({ r: 0, c: columna })];
    const formato = encabezado ? FORMATO_POR_COLUMNA[String(encabezado.v)] : undefined;
    if (!formato) continue;
    for (let renglon = 1; renglon <= rango.e.r; renglon++) {
      const celda = hoja[XLSX.utils.encode_cell({ r: renglon, c: columna })];
      if (celda && (celda.t === "n" || celda.t === "d")) celda.z = formato;
    }
  }

  return hoja;
}

/** Nombre de archivo sin caracteres que rompan la descarga o el adjunto. */
export function nombreArchivoSeguro(texto: string): string {
  return texto.replace(/[^a-zA-Z0-9_-]+/g, "_");
}
