import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import OrdenesTabla from "./_components/OrdenesTabla";
import {
  ESTADOS_ACTIVOS,
  LIMIT_ORDENES,
  type OrdenCompraRow,
} from "@/src/lib/ordenesTypes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function MisOrdenesPage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const proveedorId = await getProveedorIdActual();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOrdenes: any[] = proveedorId
    ? await db.ordenCompra.findMany({
        where: { proveedorId, estado: { in: ESTADOS_ACTIVOS } },
        orderBy: { fechaCreacion: "desc" },
        take: LIMIT_ORDENES + 1,
        include: {
          licitacion: { select: { numero: true, jerarquia: true } },
          lineas: { select: { subtotal: true } },
        },
      })
    : [];

  const hasMore = rawOrdenes.length > LIMIT_ORDENES;
  const batch = hasMore ? rawOrdenes.slice(0, LIMIT_ORDENES) : rawOrdenes;
  const initialCursor: string | null = hasMore ? batch[batch.length - 1].id : null;

  const initialData: OrdenCompraRow[] = batch.map((o: any) => ({
    id: o.id,
    numero: o.numero,
    licitacionNumero: o.licitacion.numero,
    jerarquia: o.licitacion.jerarquia,
    fechaCreacion: (o.fechaCreacion as Date).toISOString(),
    fechaEstimadaEntrega: o.fechaEstimadaEntrega
      ? (o.fechaEstimadaEntrega as Date).toISOString()
      : null,
    total: (o.lineas as { subtotal: number }[]).reduce((s, l) => s + l.subtotal, 0),
    estado: o.estado,
  }));

  return (
    <div className="max-w-6xl space-y-6">
      <PageTitle title="Mis Órdenes de Compra" />
      <OrdenesTabla
        initialData={initialData}
        initialCursor={initialCursor}
        basePath={basePath}
      />
    </div>
  );
}
