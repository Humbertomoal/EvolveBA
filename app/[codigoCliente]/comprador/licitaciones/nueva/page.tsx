import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getMapaProveedorMateriales } from "@/src/lib/proveedorMaterialesData";
import { getProductos } from "@/src/lib/productos";
import { getProveedores } from "@/src/lib/proveedores";
import { getCatalogosActivos, getTiposCambioActuales } from "@/src/lib/getCatalogos";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import { calcularSiguienteNumero } from "@/src/lib/numeroLicitacion";
import LicitacionForm from "./_components/LicitacionForm";

export default async function NuevaLicitacionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [productos, proveedores, proveedorMateriales, numerosExistentes, jerarquias, tiposLicitacion, monedas, tiposCambioSettings, usuarioActual] =
    await Promise.all([
      getProductos(),
      getProveedores(),
      getMapaProveedorMateriales(),
      // Se traen TODOS los números y el siguiente se calcula en memoria. No se
      // puede usar orderBy: { numero: "desc" } + parseInt: `numero` es String,
      // así que ese orden es LEXICOGRÁFICO y cualquier número no numérico gana
      // ("DMY-0048" > "0005" porque "D" > "0"), su parseInt da NaN y la
      // sugerencia caía al fallback de base vacía → "0001", un número ya usado.
      prisma.licitacion.findMany({ select: { numero: true } }),
      getCatalogosActivos("JERARQUIA"),
      getCatalogosActivos("TIPO_LICITACION"),
      getCatalogosActivos("MONEDA"),
      getTiposCambioActuales(),
      getUsuarioActual(),
    ]);

  const siguienteNumero = calcularSiguienteNumero(numerosExistentes.map((l) => l.numero));
  const catalogos = { jerarquias, tiposLicitacion, monedas };

  return (
    <LicitacionForm
      basePath={basePath}
      codigoCliente={codigoCliente}
      productos={productos}
      proveedores={proveedores}
      proveedorMateriales={proveedorMateriales}
      siguienteNumero={siguienteNumero}
      catalogos={catalogos}
      tiposCambioSettings={tiposCambioSettings}
      usuarioActual={usuarioActual}
    />
  );
}
