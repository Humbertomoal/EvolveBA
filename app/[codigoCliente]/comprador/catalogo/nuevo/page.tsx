import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import ProductoForm from "../_components/ProductoForm";

export default async function NuevoProductoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [familias, unidadesMedida, monedas] = await Promise.all([
    getCatalogosActivos("FAMILIA"),
    getCatalogosActivos("UNIDAD_MEDIDA"),
    getCatalogosActivos("MONEDA"),
  ]);

  return (
    <ProductoForm basePath={basePath} catalogos={{ familias, unidadesMedida, monedas }} />
  );
}
