import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getUsuarios, getRoles } from "@/src/lib/getUsuarios";
import { ensureUsuariosSeed } from "@/src/lib/usuariosSeed";
import UsuariosView from "./_components/UsuariosView";

export default async function UsuariosPage({
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

  const [usuarios, roles] = await Promise.all([
    getUsuarios(clienteId),
    getRoles(clienteId),
  ]);

  return (
    <UsuariosView
      usuarios={usuarios}
      roles={roles}
      clienteId={clienteId}
      basePath={basePath}
    />
  );
}
