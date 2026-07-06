import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getCompradorSession } from "@/src/lib/compradorSession";
import SeleccionTabla from "./_components/SeleccionTabla";
import { PageTitle } from "@/app/_components/PageHeaderContext";

export type LicitacionCerrada = {
  id: string;
  numero: string;
  tipoLicitacion: string | null;
  fechaEjecucion: string | null;
  fechaCerrada: string | null;
  jerarquia: string | null;
  importeVenta: number | null;
  costoObjetivo: number | null;
  estado: string;
  costoLicitacion: number;
};

export default async function SeleccionProveedoresPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const licitaciones = await prisma.licitacion.findMany({
    where: {
      eliminado: false,
      estado: { in: ["Cerrada", "Finalizada", "Cancelada"] },
      ...(puedeVerTodo ? {} : { compradorId }),
    },
    orderBy: { fechaEjecucion: "desc" },
    select: {
      id: true,
      numero: true,
      tipoLicitacion: true,
      fechaEjecucion: true,
      fechaCerrada: true,
      jerarquia: true,
      importeVenta: true,
      costoObjetivo: true,
      estado: true,
      asignaciones: {
        select: { cantidadAsignada: true, precioUnitario: true },
      },
    },
  });

  const rows: LicitacionCerrada[] = licitaciones.map((l) => ({
    id: l.id,
    numero: l.numero,
    tipoLicitacion: l.tipoLicitacion,
    fechaEjecucion: l.fechaEjecucion?.toISOString() ?? null,
    fechaCerrada: l.fechaCerrada?.toISOString() ?? null,
    jerarquia: l.jerarquia,
    importeVenta: l.importeVenta,
    costoObjetivo: l.costoObjetivo,
    estado: l.estado,
    costoLicitacion: l.asignaciones.reduce(
      (sum, a) => sum + a.precioUnitario * a.cantidadAsignada,
      0
    ),
  }));

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Selección de Proveedores" />
      <SeleccionTabla licitaciones={rows} basePath={basePath} />
    </div>
  );
}
