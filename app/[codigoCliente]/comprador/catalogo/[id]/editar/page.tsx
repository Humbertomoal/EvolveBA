import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProductoById } from "@/src/lib/productos";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import ProductoForm from "../../_components/ProductoForm";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;
  const [producto, familias, unidadesMedida, monedas] = await Promise.all([
    getProductoById(id),
    getCatalogosActivos("FAMILIA"),
    getCatalogosActivos("UNIDAD_MEDIDA"),
    getCatalogosActivos("MONEDA"),
  ]);

  if (!producto) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Producto no encontrado
        </h1>
        <p className="text-sm text-zinc-500">
          El producto que intentas editar no existe.
        </p>
      </div>
    );
  }

  return (
    <ProductoForm
      basePath={basePath}
      productoExistente={producto}
      catalogos={{ familias, unidadesMedida, monedas }}
    />
  );
}
