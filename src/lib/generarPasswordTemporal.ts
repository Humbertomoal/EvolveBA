import crypto from "crypto";

// Excluye caracteres ambiguos (0/O, 1/l/I) para reducir errores al transcribir
// la contraseña temporal manualmente.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Genera una contraseña temporal aleatoria (8-10 caracteres alfanuméricos)
 * usando el generador criptográficamente seguro de Node. Se usa solo para
 * crear/restablecer accesos — nunca se persiste en texto plano, siempre se
 * hashea con bcrypt antes de guardarse.
 */
export function generarPasswordTemporal(): string {
  const longitud = 8 + crypto.randomInt(3); // 8, 9 o 10 caracteres
  let password = "";
  for (let i = 0; i < longitud; i++) {
    password += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return password;
}
