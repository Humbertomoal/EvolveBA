import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getRoles } from "@/src/lib/getUsuarios";
import { ensureUsuariosSeed } from "@/src/lib/usuariosSeed";
import RolesView from "./_components/RolesView";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;
  const clienteId = "default";

  try {
    await ensureUsuariosSeed(clienteId);
  } catch {
    // Migration not yet applied — seed skipped
  }

  const roles = await getRoles(clienteId);

  return <RolesView roles={roles} clienteId={clienteId} basePath={basePath} />;
}
