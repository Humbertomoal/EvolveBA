/**
 * Parsea un string de <input type="datetime-local"> (sin timezone, ej.
 * "2026-07-09T13:30") asumiendo que representa hora de Ciudad de México
 * (UTC-6 fija — México no observa horario de verano desde 2022).
 *
 * new Date(str) interpreta el string usando la zona horaria del runtime
 * que ejecuta el código. En Vercel (Server Actions) esa zona es UTC, no
 * la de México, lo que desfasaba 6 horas las fechas guardadas.
 */
export function parsearFechaMexico(fechaStr: string | null): Date | null {
  if (!fechaStr) return null;
  const [fecha, hora] = fechaStr.split("T");
  const [year, month, day] = fecha.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
}

/**
 * Convierte un Date (almacenado como instante UTC) al string
 * "YYYY-MM-DDTHH:mm" que espera un <input type="datetime-local">,
 * mostrando la hora en horario de Ciudad de México (UTC-6 fija).
 */
export function fechaParaInput(fecha: Date | string | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  const local = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/**
 * Formatea un instante (Date/ISO string) para mostrarlo en hora de
 * Ciudad de México, sin depender de la zona horaria del runtime (el
 * server en Vercel corre en UTC).
 */
export function formatFechaMexico(
  fecha: Date | string | null,
  opciones: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }
): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    ...opciones,
  });
}

// ── Fechas de SOLO DÍA ───────────────────────────────────────────────────────
//
// Campos que se capturan con <input type="date"> (sin hora):
//   LicitacionItem.fechaEntrega, Licitacion.fechaInicioRangoEntrega /
//   fechaFinRangoEntrega, OfertaItem.fechaEstimadaEntrega,
//   AsignacionMaterial.fechaObjetivo / fechaEstimadaProveedor,
//   OrdenCompraLinea.fechaEntregaObjetivo / fechaEstimadaProveedor,
//   OrdenCompra.fechaEstimadaEntrega.
//
// El servidor los guarda con `new Date("2026-11-22")`, que es MEDIANOCHE UTC
// (2026-11-22T00:00:00Z). Ese instante codifica el día que eligió el usuario, y
// el dato es correcto. Pero leído en hora de México (UTC-6) es el 21/11 a las
// 18:00, así que cualquier formateador que convierta a hora local o a
// America/Mexico_City lo muestra UN DÍA ANTES. Se ve 22 en el formulario del
// comprador y 21 en el portal del proveedor, el correo, el PDF y la OC.
//
// Por eso estos campos se leen en UTC, sin importar la zona del navegador o del
// servidor. NO usar este formateador para fechas CON hora (fechaEjecucion,
// fechaFinLicitacion, fechaCreacion, fechaPuja…): esas son instantes reales y
// van con `formatFechaMexico`.

/**
 * Formatea una fecha de SOLO DÍA como dd/mm/aaaa, leyéndola en UTC (ver arriba).
 * Acepta el Date de Prisma, su ISO ("2026-11-22T00:00:00.000Z") o el valor de
 * un <input type="date"> ("2026-11-22"). JS interpreta este último como UTC.
 */
export function formatFechaDia(
  fecha: Date | string | null | undefined,
  vacio = "—"
): string {
  if (!fecha) return vacio;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return vacio;
  return d.toLocaleDateString("es-MX", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Días entre la época de Excel (1899-12-30) y la de Unix (1970-01-01). */
const EPOCA_EXCEL_EN_DIAS = 25569;

/**
 * Para una celda de Excel con una fecha de SOLO DÍA: el NÚMERO DE SERIE de Excel
 * del día UTC guardado (2026-11-22T00:00Z → 46348), calculado a mano.
 *
 * Por qué no un Date: `xlsx` convierte un Date a serie con la zona del entorno,
 * incluido el desfase HISTÓRICO de 1899. México tenía entonces −6:36:36, así que
 * en un navegador de México una medianoche local salía como 21/11 23:59:24 y la
 * celda mostraba el día anterior. Verificado abriendo el .xlsx generado. Con el
 * número no interviene ninguna zona: la celda es exactamente ese día en
 * cualquier entorno, y con el formato dd/mm/yyyy de la columna sigue siendo una
 * fecha de Excel, que se ordena y se filtra.
 */
export function fechaDiaParaExcel(fecha: Date | string | null | undefined): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000 + EPOCA_EXCEL_EN_DIAS;
}

const PARTES_HORA_MEXICO = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Para una celda de Excel con un instante CON HORA (p. ej. la hora de una
 * puja): el número de serie de Excel de la HORA DE PARED de Ciudad de México
 * en ese instante. 2026-11-20T20:30Z → 20/11/2026 14:30.
 *
 * Excel no tiene zona horaria: la celda muestra el número tal cual. Por eso se
 * convierte EXPLÍCITAMENTE a America/Mexico_City y se arma el número a mano,
 * sin pasar un Date a `xlsx`. Esa librería usa la zona del entorno y el desfase
 * histórico de 1899. El "−6 h" que había antes solo acertaba si el archivo se
 * generaba en un servidor en UTC. Descargado desde un navegador en México, la
 * puja de las 14:30 salía 08:29.
 */
export function fechaHoraMexicoParaExcel(fecha: Date | string | null | undefined): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(
    PARTES_HORA_MEXICO.formatToParts(d).map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const paredComoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return paredComoUTC / 86_400_000 + EPOCA_EXCEL_EN_DIAS;
}
