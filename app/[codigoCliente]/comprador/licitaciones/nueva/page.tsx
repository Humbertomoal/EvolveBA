import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getMapaProveedorMateriales } from "@/src/lib/proveedorMateriales";
import { getProductos } from "@/src/lib/productos";
import { getProveedores } from "@/src/lib/proveedores";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import LicitacionForm from "./_components/LicitacionForm";

export default async function NuevaLicitacionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [productos, proveedores, proveedorMateriales, ultima, jerarquias, tiposLicitacion, monedas] =
    await Promise.all([
      getProductos(),
      getProveedores(),
      getMapaProveedorMateriales(),
      prisma.licitacion.findFirst({
        orderBy: { numero: "desc" },
        select: { numero: true },
      }),
      getCatalogosActivos("JERARQUIA"),
      getCatalogosActivos("TIPO_LICITACION"),
      getCatalogosActivos("MONEDA"),
    ]);

  const n = parseInt(ultima?.numero ?? "0", 10);
  const siguienteNumero = String(isNaN(n) ? 1 : n + 1).padStart(4, "0");
  const catalogos = { jerarquias, tiposLicitacion, monedas };

  return (
    <LicitacionForm
      basePath={basePath}
      productos={productos}
      proveedores={proveedores}
      proveedorMateriales={proveedorMateriales}
      siguienteNumero={siguienteNumero}
      catalogos={catalogos}
    />
  );
}
