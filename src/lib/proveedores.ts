import { prisma } from "@/src/lib/prisma";
import type { Proveedor, ProveedorInput } from "@/src/data/proveedores";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type ProveedorDB = {
  id: string;
  razonSocial: string;
  vendedorNombre: string | null;
  vendedorCelular: string | null;
  vendedorCorreo: string | null;
  contactoAdminNombre: string;
  contactoAdminTelefono: string | null;
  contactoAdminCorreo: string;
  tipoPersona: string;
  rfc: string;
  domicilio: string;
  estado: string;
};

// Excludes domicilioComercial — it's not migrated into the DB yet, so it's
// fetched/written separately (see *DomicilioComercialSeguro below) to avoid
// breaking the rest of the proveedor CRUD before the migration runs.
const PROVEEDOR_SELECT = {
  id: true,
  razonSocial: true,
  vendedorNombre: true,
  vendedorCelular: true,
  vendedorCorreo: true,
  contactoAdminNombre: true,
  contactoAdminTelefono: true,
  contactoAdminCorreo: true,
  tipoPersona: true,
  rfc: true,
  domicilio: true,
  estado: true,
} as const;

function mapear(p: ProveedorDB, domicilioComercial: string | null = null): Proveedor {
  return {
    id: p.id,
    razonSocial: p.razonSocial,
    vendedorNombre: p.vendedorNombre ?? "",
    vendedorCelular: p.vendedorCelular ?? "",
    vendedorCorreo: p.vendedorCorreo ?? "",
    contactoAdminNombre: p.contactoAdminNombre,
    contactoAdminTelefono: p.contactoAdminTelefono ?? "",
    contactoAdminCorreo: p.contactoAdminCorreo,
    tipoPersona: p.tipoPersona as Proveedor["tipoPersona"],
    rfc: p.rfc,
    domicilio: p.domicilio,
    domicilioComercial: domicilioComercial ?? "",
    estado: p.estado as Proveedor["estado"],
  };
}

// Migration not yet applied — read/write domicilioComercial defensively so it
// silently no-ops until the column exists.
async function getDomicilioComercialSeguro(id: string): Promise<string | null> {
  try {
    const row = await db.proveedor.findUnique({
      where: { id },
      select: { domicilioComercial: true },
    });
    return row?.domicilioComercial ?? null;
  } catch {
    return null;
  }
}

async function guardarDomicilioComercialSeguro(
  id: string,
  valor: string
): Promise<string | null> {
  try {
    const row = await db.proveedor.update({
      where: { id },
      data: { domicilioComercial: valor || null },
      select: { domicilioComercial: true },
    });
    return row.domicilioComercial ?? null;
  } catch {
    return null;
  }
}

export async function getProveedores(): Promise<Proveedor[]> {
  const rows = await prisma.proveedor.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: "asc" },
    select: PROVEEDOR_SELECT,
  });
  return rows.map((r) => mapear(r));
}

export async function getProveedorById(id: string): Promise<Proveedor | null> {
  const row = await prisma.proveedor.findUnique({ where: { id }, select: PROVEEDOR_SELECT });
  if (!row) return null;
  const domicilioComercial = await getDomicilioComercialSeguro(id);
  return mapear(row, domicilioComercial);
}

// ── Acceso al portal (Usuario vinculado) ─────────────────────────────────────

export type AccesoProveedor = {
  usuarioId: string;
  email: string;
  activo: boolean;
  primerAcceso: boolean;
  ultimoAcceso: string | null;
};

export async function getAccesoProveedor(
  proveedorId: string
): Promise<AccesoProveedor | null> {
  const row = await db.proveedor.findUnique({
    where: { id: proveedorId },
    select: {
      usuario: {
        select: {
          id: true,
          email: true,
          activo: true,
          primerAcceso: true,
          ultimoAcceso: true,
        },
      },
    },
  });
  if (!row?.usuario) return null;
  return {
    usuarioId: row.usuario.id,
    email: row.usuario.email,
    activo: row.usuario.activo,
    primerAcceso: row.usuario.primerAcceso,
    ultimoAcceso: row.usuario.ultimoAcceso?.toISOString() ?? null,
  };
}

export async function crearProveedor(datos: ProveedorInput): Promise<Proveedor> {
  const row = await prisma.proveedor.create({
    data: {
      razonSocial: datos.razonSocial,
      vendedorNombre: datos.vendedorNombre || null,
      vendedorCelular: datos.vendedorCelular || null,
      vendedorCorreo: datos.vendedorCorreo || null,
      contactoAdminNombre: datos.contactoAdminNombre,
      contactoAdminTelefono: datos.contactoAdminTelefono || null,
      contactoAdminCorreo: datos.contactoAdminCorreo,
      tipoPersona: datos.tipoPersona,
      rfc: datos.rfc,
      domicilio: datos.domicilio,
      estado: datos.estado,
      clienteId: "default",
    },
    select: PROVEEDOR_SELECT,
  });
  const domicilioComercial = await guardarDomicilioComercialSeguro(
    row.id,
    datos.domicilioComercial
  );
  return mapear(row, domicilioComercial);
}

export async function actualizarProveedor(
  id: string,
  datos: ProveedorInput
): Promise<Proveedor | null> {
  try {
    const row = await prisma.proveedor.update({
      where: { id },
      data: {
        razonSocial: datos.razonSocial,
        vendedorNombre: datos.vendedorNombre || null,
        vendedorCelular: datos.vendedorCelular || null,
        vendedorCorreo: datos.vendedorCorreo || null,
        contactoAdminNombre: datos.contactoAdminNombre,
        contactoAdminTelefono: datos.contactoAdminTelefono || null,
        contactoAdminCorreo: datos.contactoAdminCorreo,
        tipoPersona: datos.tipoPersona,
        rfc: datos.rfc,
        domicilio: datos.domicilio,
        estado: datos.estado,
      },
      select: PROVEEDOR_SELECT,
    });
    const domicilioComercial = await guardarDomicilioComercialSeguro(
      id,
      datos.domicilioComercial
    );
    return mapear(row, domicilioComercial);
  } catch {
    return null;
  }
}
