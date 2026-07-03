import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { prisma } from "@/src/lib/prisma";
import { getMensajesNoLeidos } from "@/src/lib/chatActions";
import DetalleLicitacion from "./_components/DetalleLicitacion";
import type {
  MejorPrecioItem,
  ProveedorParticipante,
} from "./_components/DetalleLicitacion";

export default async function DetalleLicitacionProcesoPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  await verificarYActualizarEstado(id);

  const licitacion = await prisma.licitacion.findUnique({
    where: { id },
    include: {
      items: {
        include: { producto: { select: { nombre: true, unidadMedida: true } } },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: {
        include: { proveedor: { select: { id: true, razonSocial: true } } },
        orderBy: { invitadoEn: "asc" },
      },
    },
  });

  if (!licitacion) {
    return (
      <div className="flex max-w-lg flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Licitación no encontrada
        </h1>
        <Link
          href={`${basePath}/comprador/licitaciones-proceso`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Volver a Licitaciones en Proceso
        </Link>
      </div>
    );
  }

  // Ofertas de la ronda actual (para estado de participación)
  const ofertasRondaActual =
    licitacion.rondaActual > 0
      ? await prisma.ofertaItem.findMany({
          where: {
            ronda: licitacion.rondaActual,
            licitacionItem: { licitacionId: id },
          },
          include: {
            proveedor: { select: { id: true } },
          },
        })
      : [];

  // ── Participantes ────────────────────────────────────────────────────────────
  const participantes: ProveedorParticipante[] =
    licitacion.proveedoresInvitados.map((lp) => {
      const proveedorId = lp.proveedor.id;
      const ofertasProveedor = ofertasRondaActual.filter(
        (o) => o.proveedorId === proveedorId
      );
      const cotizó = ofertasProveedor.length > 0;

      const ultimaCotizacion = cotizó
        ? ofertasProveedor
            .reduce(
              (latest, o) => (o.updatedAt > latest ? o.updatedAt : latest),
              ofertasProveedor[0].updatedAt
            )
            .toISOString()
        : null;

      return {
        id: proveedorId,
        razonSocial: lp.proveedor.razonSocial,
        cotizó,
        ultimaCotizacion,
        ofertaDetalle: licitacion.items.map((item) => {
          const oferta = ofertasProveedor.find(
            (o) => o.licitacionItemId === item.id
          );
          return {
            productoNombre: item.producto.nombre,
            unidadMedida: item.producto.unidadMedida,
            cantidadSolicitada: item.cantidadSolicitada,
            precioUnitario: oferta?.precioUnitario ?? null,
            cantidadDisponible: oferta?.cantidadDisponible ?? null,
            puedeCumplirFecha: oferta?.puedeCumplirFecha ?? null,
            fechaEstimadaEntrega:
              oferta?.fechaEstimadaEntrega?.toISOString() ?? null,
          };
        }),
      };
    });

  // ── Mejores precios (todas las rondas) ───────────────────────────────────────
  const todasLasOfertas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId: id } },
    include: { proveedor: { select: { razonSocial: true } } },
    orderBy: { precioUnitario: "asc" },
  });

  const mejoresPrecioItems: MejorPrecioItem[] = licitacion.items.map((item) => {
    const itemOfertas = todasLasOfertas.filter(
      (o) => o.licitacionItemId === item.id
    );

    // Mejor oferta por proveedor (ya ordenadas por precio asc, primera por proveedor = la más barata)
    const bestPerProveedor = new Map<string, (typeof itemOfertas)[0]>();
    for (const o of itemOfertas) {
      if (!bestPerProveedor.has(o.proveedorId)) {
        bestPerProveedor.set(o.proveedorId, o);
      }
    }
    const sorted = [...bestPerProveedor.values()].sort(
      (a, b) => a.precioUnitario - b.precioUnitario
    );

    if (sorted.length === 0) {
      return {
        productoNombre: item.producto.nombre,
        cantidadSolicitada: item.cantidadSolicitada,
        unidadMedida: item.producto.unidadMedida,
        mejor: null,
        segundo: null,
      };
    }

    const mejor = sorted[0];
    const cantRestante = item.cantidadSolicitada - mejor.cantidadDisponible;
    const segundo =
      cantRestante > 0 && sorted.length > 1 ? sorted[1] : null;

    return {
      productoNombre: item.producto.nombre,
      cantidadSolicitada: item.cantidadSolicitada,
      unidadMedida: item.producto.unidadMedida,
      mejor: {
        precioUnitario: mejor.precioUnitario,
        proveedorNombre: mejor.proveedor.razonSocial,
        ronda: mejor.ronda,
        cantidadDisponible: mejor.cantidadDisponible,
      },
      segundo: segundo
        ? {
            precioUnitario: segundo.precioUnitario,
            proveedorNombre: segundo.proveedor.razonSocial,
            ronda: segundo.ronda,
            cantidadDisponible: segundo.cantidadDisponible,
            cantidadNecesaria: cantRestante,
          }
        : null,
    };
  });

  const rondaFinMs =
    licitacion.rondaActual > 0 && !licitacion.esperandoDecision
      ? licitacion.inicioRondaActual
        ? licitacion.inicioRondaActual.getTime() +
          licitacion.duracionRondaMinutos * 60 * 1000
        : null
      : null;

  // Unread chat counts per proveedor (pre-migration safe)
  const noLeidosPorProveedor: Record<string, number> = {};
  try {
    const counts = await Promise.all(
      participantes.map(async (p) => ({
        id: p.id,
        count: await getMensajesNoLeidos(id, p.id, "comprador"),
      }))
    );
    for (const { id: pid, count } of counts) {
      noLeidosPorProveedor[pid] = count;
    }
  } catch {}

  return (
    <DetalleLicitacion
      id={licitacion.id}
      numero={licitacion.numero}
      estado={licitacion.estado}
      rondaActual={licitacion.rondaActual}
      maxRondas={licitacion.maxRondas}
      rondaFinMs={rondaFinMs}
      esperandoDecision={licitacion.esperandoDecision}
      participantes={participantes}
      mejoresPrecioItems={mejoresPrecioItems}
      basePath={basePath}
      noLeidosPorProveedor={noLeidosPorProveedor}
    />
  );
}
