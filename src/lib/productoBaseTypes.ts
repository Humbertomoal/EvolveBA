// ─────────────────────────────────────────────────────────────────────────────
// "Duplicar material como base" — tipos PUROS (sin Prisma).
//
// Viven aquí y no en productosActions.ts porque ese módulo es "use server" (no
// debe exportar tipos) y el buscador de ProductoForm es un Client Component: si
// importara el tipo desde un módulo que arrastra Prisma, el bundle del cliente
// jalaría pg/util-types.
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado del buscador "Partir de un material existente…". */
export type ProductoBaseOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string | null;
};

/**
 * Lo que devuelve crearProductoAction cuando NO puede crear por un motivo
 * esperado (código tomado, falló la copia de archivos del base…). En éxito la
 * acción redirige y no devuelve nada.
 */
export type ResultadoCrearProducto = {
  ok: false;
  codigo: "CODIGO_DUPLICADO" | "BASE_NO_ENCONTRADA" | "COPIA_ARCHIVOS";
  error: string;
};
