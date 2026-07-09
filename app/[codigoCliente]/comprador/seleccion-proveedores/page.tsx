import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { buscarSeleccionAction } from "@/src/lib/seleccionActions";
import { FILTROS_SELECCION_DEFAULT } from "@/src/lib/seleccionTypes";
import SeleccionTabla from "./_components/SeleccionTabla";
import { PageTitle } from "@/app/_components/PageHeaderContext";

export default async function SeleccionProveedoresPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const [initialResult, jerarquiaRows] = await Promise.all([
    buscarSeleccionAction(FILTROS_SELECCION_DEFAULT, null),
    prisma.licitacion.findMany({
      where: {
        eliminado: false,
        estado: { in: ["Cerrada", "Finalizada", "Cancelada"] },
        ...(puedeVerTodo ? {} : { compradorId }),
      },
      select: { jerarquia: true },
      distinct: ["jerarquia"],
    }),
  ]);

  const jerarquias = jerarquiaRows
    .map((r: any) => r.jerarquia)
    .filter(Boolean) as string[];

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Selección de Proveedores" />
      <SeleccionTabla
        initialData={initialResult.licitaciones}
        initialCursor={initialResult.nextCursor}
        jerarquias={jerarquias}
        basePath={basePath}
      />
    </div>
  );
}
