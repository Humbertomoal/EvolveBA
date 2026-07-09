import Link from "next/link";
import { redirect } from "next/navigation";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { prisma } from "@/src/lib/prisma";
import { getMaterialesProveedor } from "@/src/lib/proveedorMateriales";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import { getMensajesNoLeidos } from "@/src/lib/chatActions";
import LicitacionCotizacion, { type ItemDetalle } from "./_components/LicitacionCotizacion";
import ResumenOfertasView, { type MejorOfertaItem } from "./_components/ResumenOfertasView";

export default async function DetalleLicitacionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // Verificar estado antes de mostrar (no-op para Cerrada/Finalizada)
  await verificarYActualizarEstado(id);

  const [licitacion, proveedorId] = await Promise.all([
    prisma.licitacion.findUnique({
      where: { id },
      include: {
        items: {
          include: { producto: { select: { nombre: true, unidadMedida: true } } },
        },
        _count: { select: { proveedoresInvitados: true } },
      },
    }),
    getProveedorIdActual(),
  ]);

  if (!licitacion || licitacion.modoLicitacion === "Manual") {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Licitación no encontrada</h1>
        <p className="text-sm text-zinc-500">
          No existe una licitación con el identificador proporcionado.
        </p>
        <Link
          href={`${basePath}/proveedor/licitaciones`}
          className="w-fit rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
        >
          Volver a Mis Licitaciones
        </Link>
      </div>
    );
  }

  // Filtrar items según catálogo del proveedor. Si el proveedor no tiene catálogo
  // definido o no hay coincidencias, se muestran todos los items.
  const materialesIds = proveedorId ? await getMaterialesProveedor(proveedorId) : [];
  const itemsFiltrados = (() => {
    if (materialesIds.length === 0) return licitacion.items;
    const matches = licitacion.items.filter((i: any) => materialesIds.includes(i.productoId));
    return matches.length > 0 ? matches : licitacion.items;
  })();

  // ── Vista de resultados para licitaciones cerradas/finalizadas ──────────────
  if (licitacion.estado === "Cerrada" || licitacion.estado === "Finalizada") {
    const [misAsignacionesCount, totalAsignacionesCount] = await Promise.all([
      proveedorId
        ? prisma.asignacionMaterial.count({
            where: { licitacionId: id, proveedorId },
          })
        : Promise.resolve(0),
      prisma.asignacionMaterial.count({
        where: { licitacionId: id },
      }),
    ]);

    // Si tiene asignaciones → redirigir a /resultado (ganador/completado)
    if (misAsignacionesCount > 0) {
      redirect(`${basePath}/proveedor/licitaciones/${id}/resultado`);
    }

    const subEstado: "en_espera" | "no_seleccionado" =
      totalAsignacionesCount === 0 ? "en_espera" : "no_seleccionado";

    // Obtener historial de ofertas del proveedor para esta licitación
    const misOfertas = proveedorId
      ? await prisma.ofertaItem.findMany({
          where: { proveedorId, licitacionItem: { licitacionId: id } },
          select: {
            licitacionItemId: true,
            ronda: true,
            precioUnitario: true,
            cantidadDisponible: true,
            puedeCumplirFecha: true,
            fechaEstimadaEntrega: true,
          },
          orderBy: [{ licitacionItemId: "asc" }, { ronda: "asc" }],
        })
      : [];

    // Agrupar por item
    const ofertasByItem = new Map<string, typeof misOfertas>();
    for (const o of misOfertas) {
      if (!ofertasByItem.has(o.licitacionItemId)) {
        ofertasByItem.set(o.licitacionItemId, []);
      }
      ofertasByItem.get(o.licitacionItemId)!.push(o);
    }

    // Construir resumen por item (mejor oferta = precio más bajo de todas las rondas)
    const resumen: MejorOfertaItem[] = itemsFiltrados.map((item: any) => {
      const ofertas = ofertasByItem.get(item.id) ?? [];
      const porPrecio = [...ofertas].sort((a: any, b: any) => a.precioUnitario - b.precioUnitario);
      const mejor = porPrecio[0] ?? null;
      const historial = [...ofertas]
        .sort((a: any, b: any) => a.ronda - b.ronda)
        .map((o: any) => ({
          ronda: o.ronda,
          precioUnitario: o.precioUnitario,
          cantidadDisponible: o.cantidadDisponible,
        }));

      return {
        licitacionItemId: item.id,
        productoNombre: item.producto.nombre,
        unidadMedida: item.producto.unidadMedida,
        cantidadSolicitada: item.cantidadSolicitada,
        mejorPrecio: mejor?.precioUnitario ?? null,
        cantidadOfertada: mejor?.cantidadDisponible ?? null,
        rondaCotizado: mejor?.ronda ?? null,
        puedeCumplirFecha: mejor?.puedeCumplirFecha ?? null,
        fechaEstimadaEntrega: mejor?.fechaEstimadaEntrega?.toISOString() ?? null,
        historial,
      };
    });

    return (
      <ResumenOfertasView
        licitacion={{ numero: licitacion.numero, jerarquia: licitacion.jerarquia }}
        subEstado={subEstado}
        resumen={resumen}
        basePath={basePath}
      />
    );
  }

  // ── Vista de cotización activa (Programada / En Proceso) ────────────────────

  // Cuando esperandoDecision=true cargamos la última oferta de cada ítem (ronda más
  // reciente en que cotizó). En rondas activas cargamos solo la ronda actual.
  const ofertasExistentes =
    proveedorId && licitacion.rondaActual > 0
      ? licitacion.esperandoDecision
        ? await prisma.ofertaItem.findMany({
            where: { proveedorId, licitacionItem: { licitacionId: id } },
            orderBy: { ronda: "desc" },
          })
        : await prisma.ofertaItem.findMany({
            where: {
              proveedorId,
              ronda: licitacion.rondaActual,
              licitacionItem: { licitacionId: id },
            },
          })
      : [];

  // Para esperandoDecision: la primera aparición de cada ítem (desc por ronda) = la más reciente
  const ofertaMap = licitacion.esperandoDecision
    ? ofertasExistentes.reduce(
        (map: any, o: any) => {
          if (!map.has(o.licitacionItemId)) map.set(o.licitacionItemId, o);
          return map;
        },
        new Map<string, (typeof ofertasExistentes)[0]>()
      )
    : new Map(ofertasExistentes.map((o: any) => [o.licitacionItemId, o]));

  // Oferta de la ronda INMEDIATAMENTE ANTERIOR del mismo proveedor, para
  // pre-llenar los campos cuando aún no ha cotizado en la ronda actual.
  const ofertaAnteriorMap =
    proveedorId && !licitacion.esperandoDecision && licitacion.rondaActual > 1
      ? new Map(
          (
            await prisma.ofertaItem.findMany({
              where: {
                proveedorId,
                ronda: licitacion.rondaActual - 1,
                licitacionItem: { licitacionId: id },
              },
            })
          ).map((o: any) => [o.licitacionItemId, o])
        )
      : new Map<string, any>();

  const items: ItemDetalle[] = itemsFiltrados.map((item: any) => {
    const oferta = ofertaMap.get(item.id);
    const ofertaAnterior = ofertaAnteriorMap.get(item.id);
    return {
      licitacionItemId: item.id,
      nombre: item.producto.nombre,
      unidadMedida: item.producto.unidadMedida,
      especificacion: item.especificacion,
      cantidadSolicitada: item.cantidadSolicitada,
      fechaEntrega: item.fechaEntrega?.toISOString() ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      moneda: (item as any).moneda ?? "MXN",
      oferta: oferta
        ? {
            precioUnitario: oferta.precioUnitario,
            cantidadDisponible: oferta.cantidadDisponible,
            puedeCumplirFecha: oferta.puedeCumplirFecha,
            fechaEstimadaEntrega: oferta.fechaEstimadaEntrega?.toISOString() ?? null,
          }
        : null,
      ofertaAnterior: ofertaAnterior
        ? {
            precioUnitario: ofertaAnterior.precioUnitario,
            cantidadDisponible: ofertaAnterior.cantidadDisponible,
            puedeCumplirFecha: ofertaAnterior.puedeCumplirFecha,
            fechaEstimadaEntrega:
              ofertaAnterior.fechaEstimadaEntrega?.toISOString() ?? null,
          }
        : null,
    };
  });

  // Calcular fin de ronda usando inicioRondaActual (más preciso que fechaEjecucion).
  // Si inicioRondaActual es null (licitación pre-migración), fallback al cálculo anterior.
  let rondaFinMs: number | null = null;
  if (licitacion.rondaActual > 0 && !licitacion.esperandoDecision) {
    if (licitacion.inicioRondaActual) {
      rondaFinMs =
        licitacion.inicioRondaActual.getTime() +
        licitacion.duracionRondaMinutos * 60 * 1000;
    } else if (licitacion.fechaEjecucion) {
      const rondaInicioMs =
        licitacion.fechaEjecucion.getTime() +
        (licitacion.rondaActual - 1) * licitacion.duracionRondaMinutos * 60 * 1000;
      rondaFinMs = rondaInicioMs + licitacion.duracionRondaMinutos * 60 * 1000;
    }
  }

  let noLeidosInicial = 0;
  if (proveedorId) {
    try {
      noLeidosInicial = await getMensajesNoLeidos(licitacion.id, proveedorId, "proveedor");
    } catch {}
  }

  return (
    <LicitacionCotizacion
      id={licitacion.id}
      numero={licitacion.numero}
      jerarquia={licitacion.jerarquia}
      tipoLicitacion={licitacion.tipoLicitacion}
      fechaEjecucion={licitacion.fechaEjecucion?.toISOString() ?? null}
      fechaFinRangoEntrega={licitacion.fechaFinRangoEntrega?.toISOString() ?? null}
      rondaActual={licitacion.rondaActual}
      maxRondas={licitacion.maxRondas}
      rondaFinMs={rondaFinMs}
      esperandoDecision={licitacion.esperandoDecision}
      instrucciones={licitacion.instrucciones}
      proveedorId={proveedorId}
      basePath={basePath}
      items={items}
      noLeidosInicial={noLeidosInicial}
    />
  );
}
