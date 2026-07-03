import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getLicitacionesByEstado } from "@/src/lib/licitaciones";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { prisma } from "@/src/lib/prisma";
import LanzamientoTabla from "./_components/LanzamientoTabla";

export default async function LanzamientoLicitacionesPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  // Verificar Programadas que hayan cumplido su fechaEjecucion
  const programadas = await prisma.licitacion.findMany({
    where: {
      eliminado: false,
      estado: "Programada",
      ...(puedeVerTodo ? {} : { compradorId }),
    },
    select: { id: true },
  });
  await Promise.all(programadas.map(({ id }) => verificarYActualizarEstado(id)));

  const licitaciones = await getLicitacionesByEstado(
    ["Borrador", "Programada"],
    puedeVerTodo ? undefined : compradorId
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Lanzamiento de Licitaciones
        </h1>
        <Link
          href={`${basePath}/comprador/licitaciones/nueva`}
          className="flex items-center gap-2 rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-secundario)]"
        >
          <IconPlus className="h-4 w-4 shrink-0" />
          Crear nueva licitación
        </Link>
      </div>

      <LanzamientoTabla licitaciones={licitaciones} basePath={basePath} />
    </div>
  );
}
