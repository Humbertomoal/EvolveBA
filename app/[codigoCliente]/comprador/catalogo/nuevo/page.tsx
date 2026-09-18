import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import { contarProveedoresDeProducto, getProductoBase } from "@/src/lib/productos";
import ProductoForm from "../_components/ProductoForm";

export default async function NuevoProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigoCliente: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // ?base=<id> → "duplicar como base": el formulario arranca con los datos de
  // ese material. Solo esta página lo lee; la de editar no.
  const { base } = await searchParams;
  const baseId = typeof base === "string" ? base : "";

  const [familias, unidadesMedida, monedas, productoBase, proveedoresBase] =
    await Promise.all([
      getCatalogosActivos("FAMILIA"),
      getCatalogosActivos("UNIDAD_MEDIDA"),
      getCatalogosActivos("MONEDA"),
      baseId ? getProductoBase(baseId) : Promise.resolve(null),
      baseId ? contarProveedoresDeProducto(baseId) : Promise.resolve(0),
    ]);

  return (
    <ProductoForm
      // Remontar al cambiar de base (o al "Empezar en blanco"): el estado del
      // formulario y el de FileUpload se inicializan UNA vez desde props.
      key={productoBase?.id ?? "en-blanco"}
      basePath={basePath}
      catalogos={{ familias, unidadesMedida, monedas }}
      productoBase={productoBase ?? undefined}
      proveedoresBase={proveedoresBase}
      baseNoEncontrada={Boolean(baseId) && !productoBase}
    />
  );
}
