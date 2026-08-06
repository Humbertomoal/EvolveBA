import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import { getProveedorSessionSegura } from "@/src/lib/proveedorSessionSegura";
import { parseTiposCambio, type TiposCambio } from "@/src/lib/conversionMoneda";
import ResultadoView from "./_components/ResultadoView";

export type AsignacionProveedor = {
  id: string;
  productoNombre: string;
  unidadMedida: string;
  cantidadAsignada: number;
  precioUnitario: number;
  // Moneda CONGELADA de la asignación (copiada de LicitacionItem.moneda al
  // asignar). Es la que va en la orden de compra, y por tanto en la que se le
  // paga al proveedor. NO se lee de OfertaItem.moneda: esa columna está muerta
  // (ver la nota en schema.prisma).
  moneda: string;
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
  // Tipos de cambio CONGELADOS al cerrar la licitación y moneda en la que se
  // consolidan los totales. Con estos se calcula la equivalencia que ve el
  // proveedor — nunca con tipos de cambio actuales.
  tiposCambio: TiposCambio;
  monedaConsolidacion: string;
};

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // Identidad desde el JWT firmado, no desde la cookie escribible.
  const sesion = await getProveedorSessionSegura();
  if (!sesion) notFound();
  const proveedorId = sesion.proveedorId;
  const proveedor = { id: sesion.proveedorId, razonSocial: sesion.razonSocial };

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
        tiposCambio: true,
        monedaConsolidacion: true,
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
    moneda: a.moneda,
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
    tiposCambio: parseTiposCambio(licitacion.tiposCambio),
    monedaConsolidacion: licitacion.monedaConsolidacion ?? "MXN",
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
