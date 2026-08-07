// ─────────────────────────────────────────────────────────────────────────────
// Correo de contacto de un proveedor — lógica PURA (sin Prisma).
//
// Un Proveedor tiene DOS correos y no son intercambiables:
//   · vendedorCorreo       (String?)  → el comercial. Es a quien va TODO lo
//                                       operativo: credenciales de acceso,
//                                       invitaciones, resultados.
//   · contactoAdminCorreo  (String)   → administración/facturación.
//
// Durante un tiempo varios envíos usaron el administrativo, que es el campo
// obligatorio y por eso resultaba cómodo. El peor caso era ALTA_PROVEEDOR: las
// credenciales del portal llegaban a facturación en vez de al vendedor.
//
// El respaldo existe porque `vendedorCorreo` es OPCIONAL y en los datos reales
// hay proveedores sin él: preferimos entregar al administrativo antes que no
// enviar. Pero se devuelve `esRespaldo` para que el UI lo advierta y el
// comprador pueda completar la ficha del proveedor.
// ─────────────────────────────────────────────────────────────────────────────

export type CorreoProveedor = {
  /** Correo a usar. "" si el proveedor no tiene ninguno de los dos. */
  correo: string;
  /** true si se cayó al administrativo por faltar el del vendedor. */
  esRespaldo: boolean;
};

export function correoDeProveedor(p: {
  vendedorCorreo?: string | null;
  contactoAdminCorreo?: string | null;
}): CorreoProveedor {
  const vendedor = (p.vendedorCorreo ?? "").trim();
  if (vendedor) return { correo: vendedor, esRespaldo: false };

  const admin = (p.contactoAdminCorreo ?? "").trim();
  // Sin ninguno de los dos no hay a quién escribir: `esRespaldo` queda en false
  // porque no se usó el respaldo — simplemente no hay correo. El call site
  // debe filtrar por `correo` vacío, como hacía antes.
  return { correo: admin, esRespaldo: Boolean(admin) };
}

/** Atajo para los call sites que solo necesitan la dirección. */
export function soloCorreoProveedor(p: {
  vendedorCorreo?: string | null;
  contactoAdminCorreo?: string | null;
}): string {
  return correoDeProveedor(p).correo;
}
