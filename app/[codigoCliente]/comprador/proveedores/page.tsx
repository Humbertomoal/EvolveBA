import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getProveedores } from "@/src/lib/proveedores";
import ProveedoresTabla from "./_components/ProveedoresTabla";

export default async function AdministracionProveedoresPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  return (
    <ProveedoresTabla proveedores={await getProveedores()} basePath={basePath} />
  );
}
