"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ── Tipos ──────────────────────────────────────────────────────────────────────

type UsuarioInput = {
  nombre: string;
  apellido: string;
  email: string;
  password?: string | null;
  microsoftId?: string | null;
  rolId: string;
  activo?: boolean;
};

type PermisoInput = {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

type RolInput = {
  nombre: string;
  descripcion?: string | null;
  permisos: PermisoInput[];
};

// ── Usuarios ───────────────────────────────────────────────────────────────────

export async function crearUsuarioAction(
  clienteId: string,
  datos: UsuarioInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.usuario.create({
      data: {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email: datos.email.trim().toLowerCase(),
        // Passwords stored as-is for this MVP — hash with bcrypt before production
        password: datos.password?.trim() || null,
        microsoftId: datos.microsoftId?.trim() || null,
        rolId: datos.rolId,
        activo: datos.activo ?? true,
        clienteId,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un usuario con ese email." };
    return { ok: false, error: "Error al crear el usuario." };
  }
}

export async function actualizarUsuarioAction(
  id: string,
  datos: Partial<UsuarioInput>
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.usuario.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
        ...(datos.apellido !== undefined ? { apellido: datos.apellido.trim() } : {}),
        ...(datos.email !== undefined ? { email: datos.email.trim().toLowerCase() } : {}),
        ...(datos.password !== undefined ? { password: datos.password?.trim() || null } : {}),
        ...(datos.microsoftId !== undefined ? { microsoftId: datos.microsoftId?.trim() || null } : {}),
        ...(datos.rolId !== undefined ? { rolId: datos.rolId } : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un usuario con ese email." };
    return { ok: false, error: "Error al actualizar." };
  }
}

export async function toggleActivoUsuarioAction(id: string, activo: boolean): Promise<{ ok: boolean }> {
  await db.usuario.update({ where: { id }, data: { activo } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Roles ──────────────────────────────────────────────────────────────────────

export async function crearRolAction(
  clienteId: string,
  datos: RolInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rol = await db.rol.create({
      data: {
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        esAdmin: false,
        clienteId,
      },
    });
    for (const p of datos.permisos) {
      await db.rolPermiso.create({
        data: { rolId: rol.id, modulo: p.modulo, ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar },
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un rol con ese nombre." };
    return { ok: false, error: "Error al crear el rol." };
  }
}

export async function actualizarRolAction(
  id: string,
  datos: RolInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.rol.update({
      where: { id },
      data: {
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
      },
    });
    for (const p of datos.permisos) {
      await db.rolPermiso.upsert({
        where: { rolId_modulo: { rolId: id, modulo: p.modulo } },
        update: { ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar },
        create: { rolId: id, modulo: p.modulo, ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar },
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2002") return { ok: false, error: "Ya existe un rol con ese nombre." };
    return { ok: false, error: "Error al actualizar." };
  }
}

export async function eliminarRolAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const count: number = await db.usuario.count({ where: { rolId: id } });
  if (count > 0) {
    return {
      ok: false,
      error: `No se puede eliminar, hay ${count} usuario${count !== 1 ? "s" : ""} con este rol.`,
    };
  }
  await db.rolPermiso.deleteMany({ where: { rolId: id } });
  await db.rol.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}
