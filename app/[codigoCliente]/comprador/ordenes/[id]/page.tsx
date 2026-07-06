import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import OrdenCompradorDetalle from "./_components/OrdenCompradorDetalle";

export type OrdenCompradorDetalle = {
  id: string;
  numero: string;
  estado: string;
  fechaCreacion: string;
  fechaEstimadaEntrega: string | null;
  licitacionNumero: string;
  licitacionJerarquia: string | null;
  proveedorRazonSocial: string;
  lineas: {
    id: string;
    productoNombre: string;
    cantidad: number;
    unidadMedida: string;
    moneda: string;
    precioUnitario: number;
    fechaEntregaObjetivo: string | null;
    fechaEstimadaProveedor: string | null;
    subtotal: number;
  }[];
  total: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function OrdenCompradorDetallePage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await db.ordenCompra.findUnique({
    where: { id },
    include: {
      licitacion: { select: { numero: true, jerarquia: true } },
      proveedor: { select: { razonSocial: true } },
      lineas: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!raw) notFound();

  const orden: OrdenCompradorDetalle = {
    id: raw.id,
    numero: raw.numero,
    estado: raw.estado,
    fechaCreacion: (raw.fechaCreacion as Date).toISOString(),
    fechaEstimadaEntrega: raw.fechaEstimadaEntrega
      ? (raw.fechaEstimadaEntrega as Date).toISOString()
      : null,
    licitacionNumero: raw.licitacion.numero,
    licitacionJerarquia: raw.licitacion.jerarquia,
    proveedorRazonSocial: raw.proveedor.razonSocial,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineas: (raw.lineas as any[]).map((l: any) => ({
      id: l.id,
      productoNombre: l.productoNombre,
      cantidad: l.cantidad,
      unidadMedida: l.unidadMedida,
      moneda: l.moneda ?? "MXN",
      precioUnitario: l.precioUnitario,
      fechaEntregaObjetivo: l.fechaEntregaObjetivo
        ? (l.fechaEntregaObjetivo as Date).toISOString()
        : null,
      fechaEstimadaProveedor: l.fechaEstimadaProveedor
        ? (l.fechaEstimadaProveedor as Date).toISOString()
        : null,
      subtotal: l.subtotal,
    })),
    total: (raw.lineas as { subtotal: number }[]).reduce(
      (s, l) => s + l.subtotal,
      0
    ),
  };

  return <OrdenCompradorDetalle orden={orden} basePath={basePath} />;
}
