import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProductos } from "@/src/lib/productos";
import ProveedorForm from "../_components/ProveedorForm";

export default async function NuevoProveedorPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const productos = await getProductos();

  return <ProveedorForm basePath={basePath} productos={productos} />;
}
