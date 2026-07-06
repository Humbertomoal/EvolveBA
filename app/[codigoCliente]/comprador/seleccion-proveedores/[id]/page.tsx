import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import AsignacionForm from "./_components/AsignacionForm";
import SeguimientoView from "./_components/SeguimientoView";
import type {
  AsignacionDetalle,
  ItemParaAsignacion,
  OfertaParaDropdown,
} from "./_components/types";

export default async function DetalleSeleccionPage({
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
      tiempoConfirmacionHoras: true,
      importeVenta: true,
      costoObjetivo: true,
      estado: true,
      items: {
        select: {
          id: true,
          cantidadSolicitada: true,
          fechaEntrega: true,
          createdAt: true,
          producto: { select: { nombre: true, unidadMedida: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!licitacion) {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Licitación no encontrada
        </h1>
        <Link
          href={`${basePath}/comprador/seleccion-proveedores`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  // Asignaciones existentes
  const asignacionesExistentes = await prisma.asignacionMaterial.findMany({
    where: { licitacionId: id },
    include: {
      proveedor: { select: { razonSocial: true } },
      licitacionItem: {
        include: { producto: { select: { nombre: true, unidadMedida: true } } },
      },
    },
    orderBy: [{ licitacionItemId: "asc" }, { orden: "asc" }],
  });

  // Todas las ofertas para esta licitación (para dropdowns)
  const todasLasOfertas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId: id } },
    include: { proveedor: { select: { id: true, razonSocial: true } } },
    orderBy: { precioUnitario: "asc" },
  });

  // ── Construir items para la forma de asignación ──────────────────────────────
  const items: ItemParaAsignacion[] = licitacion.items.map((item: any) => {
    const itemOfertas = todasLasOfertas.filter(
      (o: any) => o.licitacionItemId === item.id
    );

    // Mejor oferta por proveedor
    const bestPerProveedor = new Map<string, (typeof itemOfertas)[0]>();
    for (const o of itemOfertas) {
      if (!bestPerProveedor.has(o.proveedorId)) {
        bestPerProveedor.set(o.proveedorId, o);
      }
    }

    const ofertas: OfertaParaDropdown[] = [...bestPerProveedor.values()]
      .sort((a: any, b: any) => a.precioUnitario - b.precioUnitario)
      .map((o: any) => ({
        proveedorId: o.proveedorId,
        proveedorNombre: o.proveedor.razonSocial,
        precioUnitario: o.precioUnitario,
        cantidadDisponible: o.cantidadDisponible,
        ronda: o.ronda,
        puedeCumplirFecha: o.puedeCumplirFecha,
        fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
      }));

    return {
      licitacionItemId: item.id,
      productoNombre: item.producto.nombre,
      unidadMedida: item.producto.unidadMedida,
      cantidadSolicitada: item.cantidadSolicitada,
      fechaEntrega: item.fechaEntrega?.toISOString() ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      moneda: (item as any).moneda ?? "MXN",
      ofertas,
    };
  });

  const licitacionInfo = {
    id: licitacion.id,
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia,
    tipoLicitacion: licitacion.tipoLicitacion,
    tiempoConfirmacionHoras: licitacion.tiempoConfirmacionHoras,
    importeVenta: licitacion.importeVenta,
    costoObjetivo: licitacion.costoObjetivo,
    estado: licitacion.estado,
  };

  // ── Si ya hay asignaciones: vista de seguimiento ─────────────────────────────
  if (asignacionesExistentes.length > 0) {
    // Fetch OC numbers for each asignacion (post-migration, via OrdenCompraLinea)
    const asignacionIds = asignacionesExistentes.map((a: any)=> a.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineasOC: any[] = asignacionIds.length > 0
      ? await (prisma as any).ordenCompraLinea.findMany({
          where: { asignacionId: { in: asignacionIds } },
          select: {
            asignacionId: true,
            ordenCompra: { select: { numero: true } },
          },
        })
      : [];
    const ocMap = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineasOC.map((l: any) => [l.asignacionId, l.ordenCompra.numero])
    );

    const asignaciones: AsignacionDetalle[] = asignacionesExistentes.map(
      (a: any) => {
        // Ofertas alternativas para reasignación (todos excepto el actual proveedor)
        const itemOfertas = todasLasOfertas.filter(
          (o: any) => o.licitacionItemId === a.licitacionItemId
        );
        const bestPerProveedor = new Map<string, (typeof itemOfertas)[0]>();
        for (const o of itemOfertas) {
          if (!bestPerProveedor.has(o.proveedorId)) {
            bestPerProveedor.set(o.proveedorId, o);
          }
        }
        const ofertasAlternativas: OfertaParaDropdown[] = [
          ...bestPerProveedor.values(),
        ]
          .filter((o: any) => o.proveedorId !== a.proveedorId)
          .sort((a: any, b: any) => a.precioUnitario - b.precioUnitario)
          .map((o: any) => ({
            proveedorId: o.proveedorId,
            proveedorNombre: o.proveedor.razonSocial,
            precioUnitario: o.precioUnitario,
            cantidadDisponible: o.cantidadDisponible,
            ronda: o.ronda,
            puedeCumplirFecha: o.puedeCumplirFecha,
            fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
          }));

        return {
          id: a.id,
          licitacionItemId: a.licitacionItemId,
          productoNombre: a.licitacionItem.producto.nombre,
          unidadMedida: a.licitacionItem.producto.unidadMedida,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          moneda: (a as any).moneda ?? "MXN",
          proveedorId: a.proveedorId,
          proveedorNombre: a.proveedor.razonSocial,
          cantidadAsignada: a.cantidadAsignada,
          precioUnitario: a.precioUnitario,
          ronda: a.ronda,
          orden: a.orden,
          fechaObjetivo: a.fechaObjetivo?.toISOString() ?? null,
          fechaEstimadaProveedor:
            a.fechaEstimadaProveedor?.toISOString() ?? null,
          estatusProveedor: a.estatusProveedor,
          fechaLimiteConfirmacion:
            a.fechaLimiteConfirmacion?.toISOString() ?? null,
          motivoRechazo: a.motivoRechazo,
          ofertasAlternativas,
          ordenNumero: ocMap.get(a.id) ?? null,
        };
      }
    );

    return (
      <SeguimientoView
        licitacion={licitacionInfo}
        asignaciones={asignaciones}
        basePath={basePath}
      />
    );
  }

  // ── Vista de asignación ──────────────────────────────────────────────────────
  return (
    <AsignacionForm
      licitacion={licitacionInfo}
      items={items}
      basePath={basePath}
    />
  );
}
