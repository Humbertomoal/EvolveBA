// ─────────────────────────────────────────────────────────────────────────────
// Identidad del proveedor — resolución SEGURA. Server-only.
//
// ── Por qué existe (no usar getProveedorIdActual para datos sensibles) ──────
//
// `proveedorSession.getProveedorIdActual()` lee la cookie `cyrgo_proveedor_id`
// y, si no está, cae al PRIMER proveedor de la base. Esa cookie se escribe sin
// httpOnly (src/auth.ts:299 y app/login/actions.ts:125) y de hecho el cliente la
// escribe a propósito: alimenta el modo "ver como proveedor" de compradores y
// admins (ProveedorTestBanner.tsx, AdminBanner.tsx, TopBar.tsx).
//
// Consecuencia: un proveedor autenticado puede abrir la consola, escribir
//   document.cookie = "cyrgo_proveedor_id=<id-de-otro>"
// y ver los datos del competidor. Para catálogo y órdenes ya es indeseable;
// para el Tablero es inaceptable, porque los indicadores de sobrecosto exponen
// PRECIOS GANADORES de la competencia.
//
// ── Cómo se cierra ─────────────────────────────────────────────────────────
// La identidad sale del JWT de Auth.js (firmado, no manipulable desde el
// navegador) y de la BD:
//
//   · usuario tipoUsuario === "proveedor"  → proveedorId SIEMPRE desde la BD por
//     usuarioId. La cookie se IGNORA por completo.
//   · usuario admin/supervisor             → se honra la cookie (modo prueba).
//   · cualquier otro caso                  → null. NUNCA un fallback a "el
//     primer proveedor": devolver a alguien es peor que no devolver a nadie.
//
// Nota sobre el JWT: session.user.proveedorId solo se puebla en el flujo de
// Microsoft (el callback `jwt` de auth.ts no lo setea en la rama de
// credentials), y los proveedores entran por contraseña. Por eso aquí se
// resuelve contra la BD a partir del id de usuario —que sí viaja firmado— en
// lugar de confiar en ese campo. Poblarlo también en la rama de credentials
// sería la mejora natural, pero toca el flujo de login y va aparte.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { auth } from "@/src/auth";
import { prisma } from "./prisma";
import { PROVEEDOR_COOKIE } from "./proveedorSession";

export type SesionProveedor = {
  proveedorId: string;
  razonSocial: string;
  /** true si un admin/supervisor está viendo el portal como este proveedor. */
  esImpersonacion: boolean;
};

export type IdentidadActual = {
  usuarioId: string;
  esProveedor: boolean;
  esAdmin: boolean;
  esSupervisor: boolean;
  /** Proveedor vinculado al usuario; null si no es un usuario de proveedor. */
  proveedorPropio: { id: string; razonSocial: string } | null;
};

/**
 * Identidad cruda del usuario autenticado, desde el JWT + BD.
 *
 * La usan las server actions para decidir CUÁNTO pueden confiar en sus propios
 * argumentos: a un proveedor se le fuerza su identidad, a un comprador/admin se
 * le respeta lo que pida (su alcance legítimo es más amplio).
 */
export async function getIdentidadActual(): Promise<IdentidadActual | null> {
  const session = await auth();
  const usuarioId = session?.user?.id;
  if (!usuarioId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      activo: true,
      tipoUsuario: true,
      rol: { select: { esAdmin: true, esSupervisor: true } },
      proveedor: { select: { id: true, razonSocial: true, eliminado: true } },
    },
  });
  if (!usuario || !usuario.activo) return null;

  const proveedor =
    usuario.proveedor && !usuario.proveedor.eliminado
      ? { id: usuario.proveedor.id, razonSocial: usuario.proveedor.razonSocial }
      : null;

  return {
    usuarioId: usuario.id,
    esProveedor: usuario.tipoUsuario === "proveedor",
    esAdmin: Boolean(usuario.rol?.esAdmin),
    esSupervisor: Boolean(usuario.rol?.esSupervisor),
    proveedorPropio: proveedor,
  };
}

/**
 * Igual que getProveedorSessionSegura pero LANZA si no hay identidad válida.
 * Pensado para server actions: una escritura que no puede establecer quién la
 * origina debe fallar ruidosamente, nunca escribir "por si acaso".
 */
export async function exigirProveedorSesion(): Promise<SesionProveedor> {
  const sesion = await getProveedorSessionSegura();
  if (!sesion) {
    throw new Error("No autorizado: se requiere una sesión de proveedor válida.");
  }
  return sesion;
}

/**
 * Proveedor cuyos datos puede ver la sesión actual, o `null` si no procede.
 * Las páginas del portal deben tratar `null` como 403 (notFound/redirect),
 * nunca como "muestra lo que haya".
 */
export async function getProveedorSessionSegura(): Promise<SesionProveedor | null> {
  const session = await auth();
  const usuarioId = session?.user?.id;
  if (!usuarioId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      activo: true,
      tipoUsuario: true,
      rol: { select: { esAdmin: true, esSupervisor: true } },
      proveedor: { select: { id: true, razonSocial: true, eliminado: true } },
    },
  });
  if (!usuario || !usuario.activo) return null;

  // ── Caso 1: es un proveedor ──────────────────────────────────────────────
  // Su identidad sale EXCLUSIVAMENTE de la relación Usuario→Proveedor. La
  // cookie no se lee: da igual lo que traiga.
  if (usuario.tipoUsuario === "proveedor") {
    if (!usuario.proveedor || usuario.proveedor.eliminado) return null;
    return {
      proveedorId: usuario.proveedor.id,
      razonSocial: usuario.proveedor.razonSocial,
      esImpersonacion: false,
    };
  }

  // ── Caso 2: admin o supervisor en modo prueba ────────────────────────────
  const puedeImpersonar = Boolean(usuario.rol?.esAdmin || usuario.rol?.esSupervisor);
  if (!puedeImpersonar) return null;

  const cookieId = (await cookies()).get(PROVEEDOR_COOKIE)?.value;
  if (!cookieId) return null;

  const proveedor = await prisma.proveedor.findFirst({
    where: { id: cookieId, eliminado: false },
    select: { id: true, razonSocial: true },
  });
  if (!proveedor) return null;

  return {
    proveedorId: proveedor.id,
    razonSocial: proveedor.razonSocial,
    esImpersonacion: true,
  };
}
