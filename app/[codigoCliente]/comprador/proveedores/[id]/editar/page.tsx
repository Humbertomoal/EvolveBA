import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import {
  getMaterialesProveedor,
  getFamiliasProveedor,
} from "@/src/lib/proveedorMateriales";
import { getProductos } from "@/src/lib/productos";
import { getAccesoProveedor, getProveedorById } from "@/src/lib/proveedores";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import ProveedorForm from "../../_components/ProveedorForm";

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [proveedor, productos, materialesIniciales, familiasCatalogo, familiasIniciales, usuarioActual, acceso] =
    await Promise.all([
      getProveedorById(id),
      getProductos(),
      getMaterialesProveedor(id),
      getCatalogosActivos("FAMILIA"),
      getFamiliasProveedor(id),
      getUsuarioActual(),
      getAccesoProveedor(id),
    ]);

  if (!proveedor) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Proveedor no encontrado
        </h1>
        <p className="text-sm text-zinc-500">
          El proveedor que intentas editar no existe.
        </p>
      </div>
    );
  }

  return (
    <ProveedorForm
      basePath={basePath}
      proveedorExistente={proveedor}
      productos={productos}
      materialesIniciales={materialesIniciales}
      familiasCatalogo={familiasCatalogo}
      familiasIniciales={familiasIniciales}
      esAdmin={usuarioActual?.esAdmin ?? false}
      acceso={acceso}
    />
  );
}
