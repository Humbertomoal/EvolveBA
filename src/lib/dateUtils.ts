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
