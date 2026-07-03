import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProductos } from "@/src/lib/productos";
import ProductosGaleria from "./_components/ProductosGaleria";

export default async function CatalogoProductosPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  return <ProductosGaleria productos={await getProductos()} basePath={basePath} />;
}
