// ─────────────────────────────────────────────────────────────────────────────
// Sugerencia del número de licitación — lógica PURA (sin Prisma).
//
// `Licitacion.numero` es un String @unique que el comprador puede EDITAR, así
// que la base puede contener cualquier cosa: "0001", "DMY-0048" (datos de
// demo), "LIC-2026-01" (numeración propia de un cliente)…
//
// La versión anterior hacía `orderBy: { numero: "desc" }` + `parseInt` sobre el
// primer resultado. Dos fallos encadenados:
//
//   1. Al ser String, ese orden es LEXICOGRÁFICO, no numérico. "DMY-0048" gana
//      sobre "0005" ("D" = 0x44 > "0" = 0x30). Por la misma razón "9999" gana
//      sobre "10000", así que el correlativo también se rompía al pasar de
//      4 dígitos.
//   2. `parseInt("DMY-0048")` → NaN, y el fallback `isNaN ? 1` —pensado para la
//      base vacía— sugería "0001", un número YA USADO. Al guardar chocaba
//      contra la constraint @unique.
//
// Aquí se filtran los números NUMÉRICOS PUROS y se toma el máximo como entero.
// ─────────────────────────────────────────────────────────────────────────────

/** Solo dígitos, sin signo ni separadores. "0005" ✓ · "DMY-0048" ✗ · "12a" ✗ */
const SOLO_DIGITOS = /^\d+$/;

/** Ancho mínimo del correlativo, para conservar el formato 0001, 0002… */
const ANCHO_MINIMO = 4;

/**
 * Siguiente número sugerido a partir de los ya existentes.
 *
 * · Ignora los que no son numéricos puros: conviven sin afectar el correlativo.
 * · Compara como ENTEROS, así que 10000 > 9999 (a diferencia del orden textual).
 * · Sin ningún número utilizable (base nueva) sugiere "0001".
 * · Conserva el padding a 4 dígitos y no lo trunca al crecer: 9999 → "10000".
 *
 * Es una SUGERENCIA editable, no una reserva: dos compradores que abran el
 * formulario a la vez reciben el mismo número y el segundo chocará contra la
 * constraint @unique al guardar. Ese caso se atiende con un mensaje legible en
 * crearLicitacionAction, no aquí.
 */
export function calcularSiguienteNumero(numeros: string[]): string {
  let maximo = 0;
  for (const numero of numeros) {
    const limpio = numero.trim();
    if (!SOLO_DIGITOS.test(limpio)) continue;
    const valor = Number.parseInt(limpio, 10);
    if (Number.isFinite(valor) && valor > maximo) maximo = valor;
  }
  return String(maximo + 1).padStart(ANCHO_MINIMO, "0");
}
