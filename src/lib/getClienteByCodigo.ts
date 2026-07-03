import { clientes, CODIGO_CLIENTE_DEFAULT, type Cliente } from "@/src/config/clientes";

/**
 * Valor de segmento usado internamente por el proxy de rutas para representar
 * "sin código de cliente en la URL". No es un código de cliente real.
 */
export const CODIGO_CLIENTE_SIN_ESPECIFICAR = "_default";

export function getClienteByCodigo(codigo?: string | null): Cliente | null {
  const codigoEfectivo =
    !codigo || codigo === CODIGO_CLIENTE_SIN_ESPECIFICAR
      ? CODIGO_CLIENTE_DEFAULT
      : codigo;

  return clientes.find((cliente) => cliente.codigo === codigoEfectivo) ?? null;
}
