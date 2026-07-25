"use server";

import {
  actualizarMonedaDesdeBanxico,
  type ResultadoBanxico,
} from "./banxicoCore";

/**
 * Server Action del botón manual "Actualizar desde Banxico" (Settings → Monedas).
 * Actualiza el tipo de cambio FIX USD/MXN. Es un wrapper delgado sobre el núcleo
 * compartido (banxicoCore.ts) — la misma lógica que usa el cron, sin duplicar.
 * 100% server-side: el token de Banxico nunca sale al cliente.
 */
export async function obtenerTipoCambioBanxico(
  clienteId: string = "default"
): Promise<ResultadoBanxico> {
  return actualizarMonedaDesdeBanxico(clienteId, "USD");
}
