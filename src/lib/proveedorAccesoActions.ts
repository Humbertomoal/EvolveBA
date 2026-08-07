"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getUsuarioActual } from "./usuarioActual";
import { generarPasswordTemporal } from "./generarPasswordTemporal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type ResultadoAcceso =
  | { ok: true; email: string; passwordTemporal: string }
  | { ok: false; error: string };

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/**
 * ¿Es una violación de unicidad (P2002) sobre Usuario.email? Se inspecciona sin
 * importar tipos de Prisma para no arrastrar su runtime a este módulo.
 */
function esCorreoDuplicado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes("email"));
  return target === undefined || String(target).includes("email");
}

async function verificarEsAdmin(): Promise<string | null> {
  const usuario = await getUsuarioActual();
  if (!usuario?.esAdmin) {
    return "Solo un Administrador puede gestionar el acceso al portal de proveedores.";
  }
  return null;
}

// El Rol "Proveedor" solo existe para satisfacer Usuario.rolId (requerido) —
// no gobierna permisos, porque el panel /proveedor no usa RolPermiso.
async function getOrCrearRolProveedor(clienteId: string) {
  let rol = await db.rol.findFirst({ where: { nombre: "Proveedor", clienteId } });
  if (!rol) {
    rol = await db.rol.create({
      data: {
        nombre: "Proveedor",
        descripcion: "Acceso al portal de proveedores",
        esAdmin: false,
        esSupervisor: false,
        clienteId,
      },
    });
  }
  return rol;
}

function splitNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: "Proveedor", apellido: "" };
  if (partes.length === 1) return { nombre: partes[0], apellido: "" };
  return { nombre: partes[0], apellido: partes.slice(1).join(" ") };
}

function revalidar(basePath: string, proveedorId: string) {
  revalidatePath(`${basePath}/comprador/proveedores/${proveedorId}/editar`);
}

export async function crearAccesoProveedorAction(
  proveedorId: string,
  email: string,
  basePath: string
): Promise<ResultadoAcceso> {
  const errorAuth = await verificarEsAdmin();
  if (errorAuth) return { ok: false, error: errorAuth };

  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
    return { ok: false, error: "Ingresa un correo electrónico válido." };
  }

  const proveedor = await db.proveedor.findUnique({
    where: { id: proveedorId },
    select: { id: true, usuarioId: true, contactoAdminNombre: true, clienteId: true },
  });
  if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
  if (proveedor.usuarioId) {
    return { ok: false, error: "Este proveedor ya tiene un acceso al portal creado." };
  }

  const emailExistente = await db.usuario.findUnique({ where: { email: emailNormalizado } });
  if (emailExistente) {
    return { ok: false, error: "Ya existe un usuario con ese correo electrónico." };
  }

  const rol = await getOrCrearRolProveedor(proveedor.clienteId);
  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 12);
  const { nombre, apellido } = splitNombre(proveedor.contactoAdminNombre);

  const nuevoUsuario = await db.usuario.create({
    data: {
      nombre,
      apellido,
      email: emailNormalizado,
      password: passwordHash,
      activo: true,
      rolId: rol.id,
      clienteId: proveedor.clienteId,
      tipoUsuario: "proveedor",
      primerAcceso: true,
      emailVerificado: false,
    },
  });

  await db.proveedor.update({
    where: { id: proveedorId },
    data: { usuarioId: nuevoUsuario.id },
  });

  revalidar(basePath, proveedorId);
  return { ok: true, email: emailNormalizado, passwordTemporal };
}

export async function restablecerPasswordProveedorAction(
  proveedorId: string,
  basePath: string
): Promise<ResultadoAcceso> {
  const errorAuth = await verificarEsAdmin();
  if (errorAuth) return { ok: false, error: errorAuth };

  const proveedor = await db.proveedor.findUnique({
    where: { id: proveedorId },
    select: { usuarioId: true },
  });
  if (!proveedor?.usuarioId) {
    return { ok: false, error: "Este proveedor no tiene acceso al portal." };
  }

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 12);

  const usuario = await db.usuario.update({
    where: { id: proveedor.usuarioId },
    data: { password: passwordHash, primerAcceso: true },
    select: { email: true },
  });

  revalidar(basePath, proveedorId);
  return { ok: true, email: usuario.email, passwordTemporal };
}

/**
 * Cambia el correo con el que el proveedor INICIA SESIÓN (Usuario.email).
 *
 * ── Por qué existe una acción aparte ───────────────────────────────────────
 * `Usuario.email` y `Proveedor.vendedorCorreo` son campos INDEPENDIENTES a
 * propósito: uno es la credencial de login, el otro el contacto comercial. El
 * de login se captura una sola vez al crear el acceso y nada lo volvía a tocar,
 * así que editar el correo del vendedor no cambiaba con qué correo entra el
 * proveedor —ni a dónde llega el restablecimiento de contraseña—, y quedaban
 * desincronizados sin que nada lo delatara.
 *
 * Esta acción NO toca vendedorCorreo. Cambiar uno no cambia el otro.
 *
 * ── Permisos ───────────────────────────────────────────────────────────────
 * Es una acción de administración: la identidad sale de la sesión server-side
 * (verificarEsAdmin) y un proveedor no puede invocarla para cambiarse el suyo
 * ni el de un competidor.
 */
export async function cambiarCorreoAccesoProveedorAction(
  proveedorId: string,
  nuevoEmail: string,
  basePath: string
): Promise<ResultadoAccion & { emailAnterior?: string; email?: string }> {
  const errorAuth = await verificarEsAdmin();
  if (errorAuth) return { ok: false, error: errorAuth };

  // Misma normalización que crearAccesoProveedorAction: el login es
  // case-insensitive en la práctica, así que se guarda siempre en minúsculas.
  const emailNormalizado = nuevoEmail.trim().toLowerCase();
  if (!emailNormalizado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
    return { ok: false, error: "Ingresa un correo electrónico válido." };
  }

  const proveedor = await db.proveedor.findUnique({
    where: { id: proveedorId },
    select: { usuarioId: true },
  });
  if (!proveedor?.usuarioId) {
    return { ok: false, error: "Este proveedor no tiene acceso al portal." };
  }

  const usuarioActual = await db.usuario.findUnique({
    where: { id: proveedor.usuarioId },
    select: { email: true },
  });
  if (!usuarioActual) {
    return { ok: false, error: "No se encontró el usuario de acceso del proveedor." };
  }
  if (usuarioActual.email.toLowerCase() === emailNormalizado) {
    return { ok: false, error: "El proveedor ya inicia sesión con ese correo." };
  }

  // Usuario.email es @unique GLOBAL (no por cliente): el correo puede estar
  // tomado por un comprador, un admin o el usuario de otro proveedor.
  const existente = await db.usuario.findUnique({
    where: { email: emailNormalizado },
    select: { id: true },
  });
  if (existente) {
    return { ok: false, error: "Ese correo ya está en uso por otro usuario." };
  }

  try {
    await db.usuario.update({
      where: { id: proveedor.usuarioId },
      data: { email: emailNormalizado },
    });
  } catch (error) {
    // Carrera: alguien tomó ese correo entre la verificación y el update.
    // Sin esto el comprador vería el error crudo de Prisma.
    if (esCorreoDuplicado(error)) {
      return { ok: false, error: "Ese correo ya está en uso por otro usuario." };
    }
    throw error;
  }

  revalidar(basePath, proveedorId);
  return { ok: true, emailAnterior: usuarioActual.email, email: emailNormalizado };
}

export async function toggleActivoAccesoProveedorAction(
  proveedorId: string,
  activo: boolean,
  basePath: string
): Promise<ResultadoAccion> {
  const errorAuth = await verificarEsAdmin();
  if (errorAuth) return { ok: false, error: errorAuth };

  const proveedor = await db.proveedor.findUnique({
    where: { id: proveedorId },
    select: { usuarioId: true },
  });
  if (!proveedor?.usuarioId) {
    return { ok: false, error: "Este proveedor no tiene acceso al portal." };
  }

  await db.usuario.update({
    where: { id: proveedor.usuarioId },
    data: { activo },
  });

  revalidar(basePath, proveedorId);
  return { ok: true };
}
