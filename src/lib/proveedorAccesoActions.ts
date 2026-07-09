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
