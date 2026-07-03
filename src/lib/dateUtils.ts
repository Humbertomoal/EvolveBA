/**
 * Converts a UTC Date to a "YYYY-MM-DDTHH:mm" string in the local timezone,
 * suitable as the value for a datetime-local input.
 *
 * Without this, d.toISOString().slice(0,16) returns UTC time, causing the
 * input to display a time offset equal to the user's UTC difference.
 */
export function fechaParaInput(fecha: Date | string | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  const offset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
}
