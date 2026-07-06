import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import CapturaManualForm from "./_components/CapturaManualForm";

export default async function CapturaManualPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const licitacion = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      jerarquia: true,
      tipoLicitacion: true,
      estado: true,
      modoLicitacion: true,
      items: {
        select: {
          id: true,
          cantidadSolicitada: true,
          fechaEntrega: true,
          producto: { select: { nombre: true, unidadMedida: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: {
        select: { proveedor: { select: { id: true, razonSocial: true } } },
        orderBy: { invitadoEn: "asc" },
      },
    },
  });

  if (!licitacion || licitacion.modoLicitacion !== "Manual") {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Licitación no encontrada
        </h1>
        <Link
          href={`${basePath}/comprador/licitaciones-proceso`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  // Load existing offers to pre-fill the form
  const ofertasExistentes = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId: id } },
    select: {
      licitacionItemId: true,
      proveedorId: true,
      precioUnitario: true,
      cantidadDisponible: true,
    },
  });

  const proveedores = licitacion.proveedoresInvitados.map((lp: any) => lp.proveedor);

  const items = licitacion.items.map((item: any) => ({
    licitacionItemId: item.id,
    productoNombre: item.producto.nombre,
    unidadMedida: item.producto.unidadMedida,
    cantidadSolicitada: item.cantidadSolicitada,
    fechaEntrega: item.fechaEntrega?.toISOString() ?? null,
  }));

  return (
    <CapturaManualForm
      licitacion={{
        id: licitacion.id,
        numero: licitacion.numero,
        jerarquia: licitacion.jerarquia,
        tipoLicitacion: licitacion.tipoLicitacion,
        estado: licitacion.estado,
      }}
      items={items}
      proveedores={proveedores}
      ofertasExistentes={ofertasExistentes}
      basePath={basePath}
    />
  );
}
