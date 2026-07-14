/** Formatea una fecha en hora de Ciudad de México para los documentos PDF. "N/A" si es null. */
export function formatFechaPdf(fecha: Date | string | null | undefined): string {
  if (!fecha) return "N/A";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Envuelve un valor opcional devolviendo "N/A" cuando es null/undefined/vacío. */
export function nd(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "N/A";
  return String(valor);
}

/** Sanea un texto para usarlo como parte del nombre de archivo de un PDF descargado. */
export function sanitizarNombreArchivo(texto: string): string {
  return texto.trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
}
