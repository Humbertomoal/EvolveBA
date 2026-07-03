import { prisma } from "@/src/lib/prisma";
import type { Proveedor, ProveedorInput } from "@/src/data/proveedores";

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

function mapear(p: ProveedorDB): Proveedor {
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
    estado: p.estado as Proveedor["estado"],
  };
}

export async function getProveedores(): Promise<Proveedor[]> {
  const rows = await prisma.proveedor.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapear);
}

export async function getProveedorById(id: string): Promise<Proveedor | null> {
  const row = await prisma.proveedor.findUnique({ where: { id } });
  return row ? mapear(row) : null;
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
  });
  return mapear(row);
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
    });
    return mapear(row);
  } catch {
    return null;
  }
}
