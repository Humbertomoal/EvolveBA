/**
 * Proveedores que los scripts de catálogo NUNCA alimentan: ni la asignación
 * por familia (asignar-materiales-por-familia.ts) ni la carga de materiales
 * (cargar-materiales-electricos.ts). Una sola lista para los dos.
 *
 * id → motivo.
 */
export const PROVEEDORES_EXCLUIDOS: Record<string, string> = {
  cmwkzpizr000004l8pa63036j: "Ejemplo tadeo (pendiente de verificar quién es)",
};
