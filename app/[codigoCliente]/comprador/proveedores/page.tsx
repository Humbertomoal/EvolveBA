import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProveedores, getMapaAccesoProveedores } from "@/src/lib/proveedores";
import { getMapaProveedorMateriales } from "@/src/lib/proveedorMateriales";
import ProveedoresTabla from "./_components/ProveedoresTabla";

export default async function AdministracionProveedoresPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [proveedores, mapaAcceso, mapaMateriales] = await Promise.all([
    getProveedores(),
    getMapaAccesoProveedores(),
    getMapaProveedorMateriales(),
  ]);

  return (
    <ProveedoresTabla
      proveedores={proveedores}
      basePath={basePath}
      codigoCliente={codigoCliente}
      mapaAcceso={mapaAcceso}
      mapaMateriales={mapaMateriales}
    />
  );
}
