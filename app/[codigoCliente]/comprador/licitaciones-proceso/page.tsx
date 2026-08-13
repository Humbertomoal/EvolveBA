import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getLicitacionesByEstado, type MejorOfertaItem } from "@/src/lib/licitaciones";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { mejorOfertaValida } from "@/src/lib/ofertaValida";
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
        // `include` trae todos los escalares, `noDisponible` incluido — que es
        // lo que mejorOfertaValida necesita para descartar los "no dispongo".
        ofertas: {
          include: { proveedor: { select: { razonSocial: true } } },
        },
      },
    });

    // El mínimo NO se calcula aquí. Antes esto era `orderBy: precioUnitario asc`
    // + `ofertas[0]`, y un proveedor que marcó "no dispongo" (precio 0) salía
    // primero y se anunciaba como ganador a $0 en todas las partidas.
    // Sin anotar los callbacks como `any`: el tipo que infiere Prisma es lo que
    // deja a mejorOfertaValida devolver la oferta COMPLETA (con ronda y
    // proveedor) en vez de degradarse a la forma mínima OfertaEvaluable.
    mejoresOfertas[lic.id] = items
      .filter((item) => item.ofertas.length > 0)
      .map((item) => {
        const best = mejorOfertaValida(item.ofertas);
        return {
          productoNombre: item.producto.nombre,
          // La partida se sigue listando aunque no haya ganador: que nadie
          // cotizara de verdad es información que el comprador necesita ANTES
          // de decidir, no algo que deba desaparecer de la lista.
          ronda: best?.ronda ?? null,
          precioUnitario: best?.precioUnitario ?? null,
          proveedorNombre: best?.proveedor.razonSocial ?? null,
        };
      });
  }

  return (
    <div className="pagina-listado space-y-6">
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
