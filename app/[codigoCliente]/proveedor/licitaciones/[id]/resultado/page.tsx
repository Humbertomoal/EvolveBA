import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import ResultadoView from "./_components/ResultadoView";

export type AsignacionProveedor = {
  id: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadAsignada: number;
  precioUnitario: number;
  ronda: number;
  orden: number;
  fechaObjetivo: string | null;
  fechaEstimadaProveedor: string | null;
  estatusProveedor: string;
  fechaLimiteConfirmacion: string | null;
  fechaConfirmacion: string | null;
  motivoRechazo: string | null;
};

export type LicitacionResultado = {
  id: string;
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
};

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const proveedorId = await getProveedorIdActual();
  const proveedor = proveedorId
    ? await prisma.proveedor.findUnique({
        where: { id: proveedorId },
        select: { id: true, razonSocial: true },
      })
    : null;

  if (!proveedor) {
    return (
      <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <p className="text-sm text-zinc-500">Proveedor no encontrado.</p>
      </div>
    );
  }

  const [licitacion, asignacionesRaw] = await Promise.all([
    prisma.licitacion.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        jerarquia: true,
        tipoLicitacion: true,
        modoLicitacion: true,
      },
    }),
    prisma.asignacionMaterial.findMany({
      where: { licitacionId: id, proveedorId: proveedor.id },
      include: {
        licitacionItem: {
          include: { producto: { select: { nombre: true, unidadMedida: true } } },
        },
      },
      orderBy: [{ licitacionItemId: "asc" }, { orden: "asc" }],
    }),
  ]);

  if (!licitacion || licitacion.modoLicitacion === "Manual") {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Licitación no encontrada</h1>
        <Link
          href={`${basePath}/proveedor/licitaciones`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Volver a Mis Licitaciones
        </Link>
      </div>
    );
  }

  const asignaciones: AsignacionProveedor[] = asignacionesRaw.map((a: any) => ({
    id: a.id,
    productoNombre: a.licitacionItem.producto.nombre,
    unidadMedida: a.licitacionItem.producto.unidadMedida,
    cantidadAsignada: a.cantidadAsignada,
    precioUnitario: a.precioUnitario,
    ronda: a.ronda,
    orden: a.orden,
    fechaObjetivo: a.fechaObjetivo?.toISOString() ?? null,
    fechaEstimadaProveedor: a.fechaEstimadaProveedor?.toISOString() ?? null,
    estatusProveedor: a.estatusProveedor,
    fechaLimiteConfirmacion: a.fechaLimiteConfirmacion?.toISOString() ?? null,
    fechaConfirmacion: a.fechaConfirmacion?.toISOString() ?? null,
    motivoRechazo: a.motivoRechazo,
  }));

  const licitacionInfo: LicitacionResultado = {
    id: licitacion.id,
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia,
    tipoLicitacion: licitacion.tipoLicitacion,
  };

  return (
    <ResultadoView
      licitacion={licitacionInfo}
      asignaciones={asignaciones}
      proveedorNombre={proveedor.razonSocial}
      basePath={basePath}
    />
  );
}
