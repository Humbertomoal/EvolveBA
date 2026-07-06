import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import {
  getMaterialesProveedor,
} from "@/src/lib/proveedorMateriales";
import { getProductos } from "@/src/lib/productos";
import { prisma } from "@/src/lib/prisma";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import type { Proveedor } from "@/src/data/proveedores";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import CatalogoView from "./_components/CatalogoView";

export default async function MiCatalogoMiInformacionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [proveedorId, productos] = await Promise.all([
    getProveedorIdActual(),
    getProductos(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proveedor: Proveedor | null = proveedorId
    ? (await prisma.proveedor.findUnique({ where: { id: proveedorId } })) as any
    : null;

  if (!proveedor) {
    return (
      <div className="space-y-2">
        <PageTitle title="Mi Catálogo y Mi Información" />
        <p className="text-sm text-zinc-500">
          No hay proveedores registrados aún.
        </p>
      </div>
    );
  }

  const materialesIds = await getMaterialesProveedor(proveedor.id);
  const materialesAsignados = productos.filter((p) =>
    materialesIds.includes(p.id)
  );

  return (
    <CatalogoView
      basePath={basePath}
      proveedor={proveedor}
      productos={productos}
      materialesAsignados={materialesAsignados}
    />
  );
}
