import { prisma } from "./prisma";
import type { RolDTO, UsuarioDTO } from "./usuariosTypes";

// Re-export so server-side callers can import from one place
export { MODULOS } from "./usuariosTypes";
export type { ModuloKey, RolDTO, RolPermisoDTO, UsuarioDTO } from "./usuariosTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function getRoles(clienteId = "default"): Promise<RolDTO[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles: any[] = await db.rol.findMany({
      where: { clienteId },
      include: {
        permisos: {
          select: { modulo: true, ver: true, crear: true, editar: true, eliminar: true },
        },
        _count: { select: { usuarios: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return roles.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esAdmin: r.esAdmin,
      esSupervisor: r.esSupervisor ?? false,
      clienteId: r.clienteId,
      usuariosCount: r._count.usuarios,
      permisos: r.permisos,
    }));
  } catch {
    return [];
  }
}

export async function getUsuarios(clienteId = "default"): Promise<UsuarioDTO[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuarios: any[] = await db.usuario.findMany({
      where: { clienteId },
      include: { rol: { select: { nombre: true } } },
      orderBy: { createdAt: "asc" },
    });
    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      avatar: u.avatar,
      activo: u.activo,
      usaMicrosoft: !!u.microsoftId,
      rolId: u.rolId,
      rolNombre: u.rol.nombre,
      ultimoAcceso: u.ultimoAcceso ? (u.ultimoAcceso as Date).toISOString() : null,
    }));
  } catch {
    return [];
  }
}
