/**
 * Pruebas del formateador de fechas de SOLO DÍA (src/lib/dateUtils.ts).
 *
 * Correr:  npx tsx scripts/pruebas/fechas.ts
 *
 * Tiene que pasar en CUALQUIER zona horaria, así que la prueba corre todas sus
 * aserciones bajo varias zonas: cambia `process.env.TZ` en tiempo de ejecución
 * (Node lo respeta) y COMPRUEBA que el cambio se aplicó antes de probar. Una
 * zona que no se aplicara haría fallar la prueba en vez de pasar en silencio.
 *
 * No se usa `TZ=... npx tsx` desde la terminal: Git Bash en Windows intercepta
 * esa variable y Node arranca en la zona del sistema sin avisar.
 */
import assert from "node:assert/strict";
import { fechaDiaParaExcel, formatFechaDia, formatFechaMexico } from "../../src/lib/dateUtils";

const ZONAS = [
  "America/Mexico_City", // UTC-6: donde se ve el bug
  "UTC", // Vercel
  "Pacific/Kiritimati", // UTC+14
  "Pacific/Pago_Pago", // UTC-11
  "Asia/Tokyo", // UTC+9
  "America/Tijuana", // con horario de verano
];

let total = 0;

function enZona(zona: string, f: () => void) {
  process.env.TZ = zona;
  assert.equal(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    zona,
    `no se pudo cambiar la zona del proceso a ${zona}`
  );
  f();
  console.log(`✓ ${zona.padEnd(20)} (desfase ${-new Date(2026, 10, 22).getTimezoneOffset() / 60} h)`);
}

function prueba(nombre: string, f: () => void) {
  console.log(`\n${nombre}`);
  for (const zona of ZONAS) enZona(zona, f);
  total++;
}

prueba("el valor guardado es medianoche UTC", () => {
  // Así guarda el servidor una fecha de <input type="date">: new Date("2026-11-22").
  assert.equal(new Date("2026-11-22").toISOString(), "2026-11-22T00:00:00.000Z");
});

prueba("2026-11-22T00:00:00Z se formatea como 22/11/2026", () => {
  assert.equal(formatFechaDia(new Date("2026-11-22T00:00:00Z")), "22/11/2026");
  assert.equal(formatFechaDia(new Date("2026-11-22")), "22/11/2026");
});

prueba("acepta el ISO serializado y el valor de <input type=date>", () => {
  assert.equal(formatFechaDia("2026-11-22T00:00:00.000Z"), "22/11/2026");
  assert.equal(formatFechaDia("2026-11-22"), "22/11/2026");
});

prueba("bordes: primero y último del año", () => {
  assert.equal(formatFechaDia("2026-01-01T00:00:00.000Z"), "01/01/2026");
  assert.equal(formatFechaDia("2026-12-31T00:00:00.000Z"), "31/12/2026");
});

prueba("vacíos e inválidos devuelven el texto de vacío", () => {
  assert.equal(formatFechaDia(null), "—");
  assert.equal(formatFechaDia(undefined), "—");
  assert.equal(formatFechaDia(""), "—");
  assert.equal(formatFechaDia("no es fecha"), "—");
  assert.equal(formatFechaDia(null, "N/A"), "N/A"); // los PDFs
});

prueba("CONTROL: leído en hora de México, el mismo valor sale un día antes (el bug)", () => {
  // Documenta por qué existe formatFechaDia. formatFechaMexico fija
  // America/Mexico_City, así que da 21 en cualquier zona del proceso.
  assert.equal(formatFechaMexico(new Date("2026-11-22")), "21/11/2026");
});

prueba("Excel: número de serie entero del día guardado, sin depender de la zona", () => {
  // 46348 = 22/11/2026 en Excel (días desde 1899-12-30). Entero: medianoche exacta.
  assert.equal(fechaDiaParaExcel(new Date("2026-11-22")), 46348);
  assert.equal(fechaDiaParaExcel("2026-11-22T00:00:00.000Z"), 46348);
  assert.equal(fechaDiaParaExcel("2026-01-01"), 46023);
  assert.equal(fechaDiaParaExcel(null), null);
  assert.equal(fechaDiaParaExcel("basura"), null);
});

console.log(`\n${total} pruebas OK, cada una en ${ZONAS.length} zonas`);
