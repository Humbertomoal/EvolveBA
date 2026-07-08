import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getLicitacionesByEstado, type MejorOfertaItem } from "@/src/lib/licitaciones";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { prisma } from "@/src/lib/prisma";
import EnProcesoTabs from "./_components/EnProcesoTabs";
import { PageTitle } from "@/app/_components/PageHeaderContext";

export default async function LicitacionesEnProcesoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();
  console.log("[licitaciones-proceso] compradorId =", compradorId, "puedeVerTodo =", puedeVerTodo);

  // Verificar estado de todas las licitaciones En Proceso
  const enProceso = await prisma.licitacion.findMany({
    where: {
      eliminado: false,
      estado: "En Proceso",
      ...(puedeVerTodo ? {} : { compradorId }),
    },
    select: { id: true },
  });
  await Promise.all(enProceso.map(({ id }: any) => verificarYActualizarEstado(id)));

  const licitaciones = await getLicitacionesByEstado(
    ["En Proceso"],
    puedeVerTodo ? undefined : compradorId
  );

  const proveedoresLics = licitaciones.filter(
    (l) => l.modoLicitacion !== "Manual"
  );
  const manualLics = licitaciones.filter((l) => l.modoLicitacion === "Manual");
  console.log(
    "[licitaciones-proceso] total licitaciones =",
    licitaciones.length,
    "manualLics =",
    manualLics.length
  );

  // Cargar mejores ofertas históricas para licitaciones Proveedores esperandoDecision
  const mejoresOfertas: Record<string, MejorOfertaItem[]> = {};
  const conDecision = proveedoresLics.filter((l) => l.esperandoDecision);

  for (const lic of conDecision) {
    const items = await prisma.licitacionItem.findMany({
      where: { licitacionId: lic.id },
      select: {
        id: true,
        producto: { select: { nombre: true } },
        ofertas: {
          include: { proveedor: { select: { razonSocial: true } } },
          orderBy: { precioUnitario: "asc" },
        },
      },
    });

    mejoresOfertas[lic.id] = items
      .filter((item: any) => item.ofertas.length > 0)
      .map((item: any) => {
        const best = item.ofertas[0];
        return {
          productoNombre: item.producto.nombre,
          ronda: best.ronda,
          precioUnitario: best.precioUnitario,
          proveedorNombre: best.proveedor.razonSocial,
        };
      });
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageTitle title="Licitaciones en Proceso" />
      <EnProcesoTabs
        proveedoresLics={proveedoresLics}
        manualLics={manualLics}
        mejoresOfertas={mejoresOfertas}
        basePath={basePath}
      />
    </div>
  );
}
