import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const TODOS_MODULOS = [
  "proveedores", "catalogo", "licitaciones", "licitaciones_proceso",
  "seleccion_proveedores", "ordenes_compra", "licitaciones_finalizadas",
  "tablero", "configuracion", "usuarios",
];

async function upsertRol(
  clienteId: string,
  nombre: string,
  descripcion: string,
  esAdmin: boolean,
  esSupervisor = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let rol = await db.rol.findFirst({ where: { nombre, clienteId } });
  if (!rol) {
    rol = await db.rol.create({ data: { nombre, descripcion, esAdmin, esSupervisor, clienteId } });
  }
  return rol;
}

async function upsertPermiso(
  rolId: string,
  modulo: string,
  perms: { ver: boolean; crear: boolean; editar: boolean; eliminar: boolean }
) {
  await db.rolPermiso.upsert({
    where: { rolId_modulo: { rolId, modulo } },
    update: perms,
    create: { rolId, modulo, ...perms },
  });
}

export async function ensureUsuariosSeed(clienteId = "default") {
  // ── Administrador ──────────────────────────────────────────────────────────
  const admin = await upsertRol(clienteId, "Administrador", "Acceso total al sistema", true, false);
  for (const modulo of TODOS_MODULOS) {
    await upsertPermiso(admin.id, modulo, { ver: true, crear: true, editar: true, eliminar: true });
  }

  // ── Gerente de Compras ─────────────────────────────────────────────────────
  const gerente = await upsertRol(
    clienteId,
    "Gerente de Compras",
    "Supervisión de todas las licitaciones del sistema",
    false,
    true
  );
  for (const modulo of TODOS_MODULOS) {
    const acceso = !["usuarios", "configuracion"].includes(modulo);
    await upsertPermiso(gerente.id, modulo, {
      ver: acceso, crear: acceso, editar: acceso, eliminar: false,
    });
  }

  // ── Comprador ──────────────────────────────────────────────────────────────
  const comprador = await upsertRol(clienteId, "Comprador", "Acceso operativo sin administración", false, false);
  for (const modulo of TODOS_MODULOS) {
    const acceso = !["usuarios", "configuracion"].includes(modulo);
    await upsertPermiso(comprador.id, modulo, {
      ver: acceso, crear: acceso, editar: acceso, eliminar: false,
    });
  }

  // ── Solo lectura ───────────────────────────────────────────────────────────
  const lectura = await upsertRol(clienteId, "Solo lectura", "Solo puede ver información, sin modificar", false, false);
  for (const modulo of TODOS_MODULOS) {
    await upsertPermiso(lectura.id, modulo, { ver: true, crear: false, editar: false, eliminar: false });
  }

  // ── Usuario administrador del sistema ──────────────────────────────────────
  const adminEmail = "admin@cyrgo.com";
  const existe = await db.usuario.findUnique({ where: { email: adminEmail } });
  if (!existe) {
    const passwordHash = await bcrypt.hash("Admin2026!", 12);
    await db.usuario.create({
      data: {
        nombre: "Admin",
        apellido: "CYRGO",
        email: adminEmail,
        password: passwordHash,
        activo: true,
        rolId: admin.id,
        clienteId,
        emailVerificado: true,
        primerAcceso: false,
        tipoUsuario: "comprador",
      },
    });
  }
}
