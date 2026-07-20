import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import {
  getProveedores,
  getMapaAccesoProveedores,
  getMapaCatalogoValidadoProveedores,
} from "@/src/lib/proveedores";
import ProveedoresTabla from "./_components/ProveedoresTabla";

export default async function AdministracionProveedoresPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [proveedores, mapaAcceso, mapaCatalogo] = await Promise.all([
    getProveedores(),
    getMapaAccesoProveedores(),
    getMapaCatalogoValidadoProveedores(),
  ]);

  return (
    <ProveedoresTabla
      proveedores={proveedores}
      basePath={basePath}
      codigoCliente={codigoCliente}
      mapaAcceso={mapaAcceso}
      mapaCatalogo={mapaCatalogo}
    />
  );
}
