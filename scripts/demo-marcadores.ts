/**
 * Marcadores compartidos por seed-demo.ts y limpiar-demo.ts.
 *
 * Todo lo que genera la demo lleva uno de estos marcadores. Son la ÚNICA forma
 * en que el script de limpieza decide qué borrar, así que cambiarlos aquí y no
 * en los datos ya creados dejaría huérfanos que habría que limpiar a mano.
 */

/** Prefijo de Licitacion.numero — el numero lo captura el usuario, así que este
 *  espacio de numeración no choca con el de la app (0001, 0002, …). */
export const PREFIJO_LICITACION = "DMY-";

/** Prefijo de OrdenCompra.numero. La app numera con count()+1 sobre el total,
 *  así que un namespace propio evita cualquier ambigüedad al identificarlas. */
export const PREFIJO_ORDEN = "OC-DMY-";

/** Prefijo de Proveedor.razonSocial — visible en el panel, para que nadie
 *  confunda un proveedor de demo con uno real. */
export const PREFIJO_RAZON_SOCIAL = "[DUMMY] ";

/** Patrón del correo de contacto del proveedor (el que pidió el usuario). */
export const correoContactoProveedor = (n: number) => `ti+${n}@evolveba.com.mx`;

/**
 * Dominio de LOGIN de los usuarios de demo — deliberadamente distinto del
 * corporativo.
 *
 * app/login/actions.ts:52 manda por Microsoft SSO a todo correo que termine en
 * "@evolveba.com.mx". Un usuario de demo con ese dominio nunca podría entrar con
 * contraseña (no existe en Entra ID), así que el login va por este dominio y el
 * correo de CONTACTO del proveedor conserva el patrón ti+N@evolveba.com.mx.
 */
export const DOMINIO_LOGIN_DEMO = "@proveedores-demo.mx";
export const correoLoginProveedor = (n: number) => `ti+${n}${DOMINIO_LOGIN_DEMO}`;

/** Contraseña única para los 12 usuarios de demo. */
export const PASSWORD_DEMO = "DemoEvolve2026!";

/** Prefijo de RFC, para que tampoco se confundan en listados por RFC. */
export const PREFIJO_RFC = "XXDM";

export const CLIENTE_ID = "default";
