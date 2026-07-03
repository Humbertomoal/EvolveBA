import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getTodosLosCatalogos } from "@/src/lib/getCatalogos";
import { ensureCatalogosSeed } from "@/src/lib/catalogosSeed";
import CatalogosView from "./_components/CatalogosView";

export default async function CatalogosPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;
  const clienteId = "default";

  try {
    await ensureCatalogosSeed(clienteId);
  } catch {
    // Migration not yet applied — seed skipped
  }

  const valores = await getTodosLosCatalogos(clienteId);

  return <CatalogosView valores={valores} clienteId={clienteId} basePath={basePath} />;
}
