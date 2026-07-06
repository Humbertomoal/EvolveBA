import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getCompradorSession } from "@/src/lib/compradorSession";
import OrdenesCompradorTabla from "./_components/OrdenesCompradorTabla";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import {
  ESTADOS_ACTIVOS,
  LIMIT_ORDENES,
  type OrdenCompradorRow,
} from "@/src/lib/ordenesTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function OrdenesCompradorPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();
  const licFilter = puedeVerTodo ? {} : { licitacion: { compradorId } };

  // Initial 25 active orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOrdenes: any[] = await db.ordenCompra.findMany({
    where: { estado: { in: ESTADOS_ACTIVOS }, ...licFilter },
    orderBy: { fechaCreacion: "desc" },
    take: LIMIT_ORDENES + 1,
    include: {
      licitacion: { select: { numero: true, jerarquia: true } },
      proveedor: { select: { razonSocial: true } },
      _count: { select: { lineas: true } },
    },
  });

  const hasMore = rawOrdenes.length > LIMIT_ORDENES;
  const batch = hasMore ? rawOrdenes.slice(0, LIMIT_ORDENES) : rawOrdenes;
  const initialCursor: string | null = hasMore ? batch[batch.length - 1].id : null;

  const initialData: OrdenCompradorRow[] = batch.map((o: any) => ({
    id: o.id,
    numero: o.numero,
    licitacionNumero: o.licitacion.numero,
    jerarquia: o.licitacion.jerarquia,
    proveedorNombre: o.proveedor.razonSocial,
    totalLineas: o._count.lineas,
    fechaCreacion: (o.fechaCreacion as Date).toISOString(),
    fechaEstimadaEntrega: o.fechaEstimadaEntrega
      ? (o.fechaEstimadaEntrega as Date).toISOString()
      : null,
    estado: o.estado,
  }));

  // All distinct licitación numbers for the filter dropdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLicitaciones: any[] = await db.ordenCompra.findMany({
    where: puedeVerTodo ? {} : { licitacion: { compradorId } },
    select: { licitacion: { select: { numero: true } } },
  });
  const licitacionesUnicas = [
    ...new Set(
      allLicitaciones.map((o: { licitacion: { numero: string } }) => o.licitacion.numero)
    ),
  ].sort() as string[];

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Órdenes de Compra" />
      <OrdenesCompradorTabla
        initialData={initialData}
        initialCursor={initialCursor}
        licitacionesUnicas={licitacionesUnicas}
        basePath={basePath}
      />
    </div>
  );
}
