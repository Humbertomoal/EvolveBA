import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProductos } from "@/src/lib/productos";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import ProveedorForm from "../_components/ProveedorForm";

export default async function NuevoProveedorPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [productos, familiasCatalogo, usuarioActual] = await Promise.all([
    getProductos(),
    getCatalogosActivos("FAMILIA"),
    getUsuarioActual(),
  ]);

  return (
    <ProveedorForm
      basePath={basePath}
      productos={productos}
      familiasCatalogo={familiasCatalogo}
      esAdmin={usuarioActual?.esAdmin ?? false}
    />
  );
}
