import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import {
  getMaterialesProveedor,
  getFamiliasAsignadasProveedor,
} from "@/src/lib/proveedorMaterialesData";
import { getProductos } from "@/src/lib/productos";
import { getProveedorById, getCatalogoValidadoProveedor } from "@/src/lib/proveedores";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
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

  const proveedor = proveedorId ? await getProveedorById(proveedorId) : null;

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

  const [materialesIds, familiasCatalogo, familiasProveedor, catalogoValidado] = await Promise.all([
    getMaterialesProveedor(proveedor.id),
    getCatalogosActivos("FAMILIA"),
    getFamiliasAsignadasProveedor(proveedor.id),
    getCatalogoValidadoProveedor(proveedor.id),
  ]);
  const materialesAsignados = productos.filter((p: any) =>
    materialesIds.includes(p.id)
  );

  return (
    <CatalogoView
      basePath={basePath}
      proveedor={proveedor}
      productos={productos}
      materialesAsignados={materialesAsignados}
      familiasCatalogo={familiasCatalogo}
      familiasProveedor={familiasProveedor}
      catalogoValidado={catalogoValidado}
    />
  );
}
