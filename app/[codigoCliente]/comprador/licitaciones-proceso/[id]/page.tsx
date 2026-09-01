import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { verificarYActualizarEstado } from "@/src/lib/licitacionesLogica";
import { prisma } from "@/src/lib/prisma";
import { getMensajesNoLeidos } from "@/src/lib/chatActions";
import { getDatosInvitacion } from "@/src/lib/datosInvitacion";
import { soloOfertasValidas } from "@/src/lib/ofertaValida";
import {
  calcularAnalisisPorItem,
  calcularResumenAhorro,
  primeraRondaConOferta,
} from "@/src/lib/licitacionesAhorro";
import {
  convertirAMoneda,
  faltanTiposCambio,
  notaTipoCambio,
  parseTiposCambio,
} from "@/src/lib/conversionMoneda";
import DetalleLicitacion from "./_components/DetalleLicitacion";
import type {
  MejorPrecioItem,
  ProveedorParticipante,
  AnalisisProductoItem,
  ResumenAhorro,
  RondaHistorial,
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
        where: { eliminado: false },
        include: {
          producto: { select: { nombre: true, unidadMedida: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: {
        include: {
          // Los correos de contacto NO se piden aquí: el payload de invitación
          // los resuelve por su cuenta en datosInvitacion.ts, que sí sabe que
          // vendedorCorreo manda sobre el administrativo.
          proveedor: { select: { id: true, razonSocial: true } },
        },
        orderBy: { invitadoEn: "asc" },
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
            licitacionItem: { licitacionId: id, eliminado: false },
          },
          include: {
            proveedor: { select: { id: true } },
          },
        })
      : [];

  // ── Todas las ofertas (todas las rondas) — base para participantes y análisis ──
  const todasLasOfertas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId: id, eliminado: false } },
    include: { proveedor: { select: { razonSocial: true } } },
    orderBy: { precioUnitario: "asc" },
  });

  const itemsPorId = new Map(licitacion.items.map((item: any) => [item.id, item]));

  // ── Presupuesto objetivo y moneda predominante ─────────────────────────────
  const monedaCounts = new Map<string, number>();
  for (const item of licitacion.items) {
    monedaCounts.set(item.moneda, (monedaCounts.get(item.moneda) ?? 0) + 1);
  }
  const monedaPredominante =
    [...monedaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MXN";

  // ── Tipos de cambio congelados + moneda de consolidación de la licitación ───
  const tiposCambio = parseTiposCambio(licitacion.tiposCambio);
  const monedaConsolidacion = (licitacion as any).monedaConsolidacion ?? "MXN";
  const monedasEnUso = licitacion.items.map((item: any) => item.moneda);
  const notaTC = notaTipoCambio(monedasEnUso, tiposCambio, monedaConsolidacion);
  const faltanTC = faltanTiposCambio(monedasEnUso, tiposCambio, monedaConsolidacion);

  // ── Análisis de ahorro por producto (lógica compartida) ────────────────────
  const analisisBase = calcularAnalisisPorItem(licitacion.items, todasLasOfertas);
  const analisisPorProducto: AnalisisProductoItem[] = analisisBase.map((a, i) => ({
    productoNombre: licitacion.items[i].producto.nombre,
    moneda: a.moneda,
    cantidadSolicitada: a.cantidadSolicitada,
    objetivoUnitario: a.objetivoUnitario,
    objetivoTotal: a.objetivoTotal,
    primeraRondaUnitario: a.primeraRondaUnitario,
    primeraRondaTotal: a.primeraRondaTotal,
    mejorActualUnitario: a.mejorActualUnitario,
    mejorActualTotal: a.mejorActualTotal,
    variacionPct: a.variacionPct,
    ahorroTotal: a.ahorroTotal,
  }));

  const resumenAhorro: ResumenAhorro = {
    ...calcularResumenAhorro(
      analisisBase,
      todasLasOfertas.length > 0,
      tiposCambio,
      monedaConsolidacion
    ),
    monedaPredominante,
  };
  const { presupuestoObjetivoTotal } = resumenAhorro;
  // Fallback a 1 para evitar división por cero al calcular porcentajes (usado
  // más abajo en el historial de rondas por proveedor).
  const presupuestoObjetivoSafe = presupuestoObjetivoTotal || 1;

  // ── Participantes (con evolución de cotización por ronda) ─────────────────────
  const participantes: ProveedorParticipante[] =
    licitacion.proveedoresInvitados.map((lp: any) => {
      const proveedorId = lp.proveedor.id;
      const ofertasProveedorRondaActual = ofertasRondaActual.filter(
        (o: any) => o.proveedorId === proveedorId
      );
      const cotizó = ofertasProveedorRondaActual.length > 0;

      const ultimaCotizacion = cotizó
        ? ofertasProveedorRondaActual
            .reduce(
              (latest: any, o: any) => (o.updatedAt > latest ? o.updatedAt : latest),
              ofertasProveedorRondaActual[0].updatedAt
            )
            .toISOString()
        : null;

      // ── Historial completo de este proveedor (todas las rondas) ──────────────
      // Filtrado aquí para que TODO lo que se derive abajo —total inicial, mejor
      // total actual, variación, materiales cotizados— ignore las ofertas en 0 y
      // las marcadas "no dispongo". Un solo 0 hundía el total del proveedor y lo
      // dejaba encabezando el comparativo.
      const ofertasProveedor = soloOfertasValidas(
        todasLasOfertas.filter((o: any) => o.proveedorId === proveedorId)
      );

      // "Total Inicial" = la primera ronda en la que el proveedor realmente
      // pujó (no necesariamente la ronda 1) — misma lógica de "primera ronda
      // válida" que el análisis de ahorro por material, aplicada por proveedor.
      const primeraRondaProveedor = primeraRondaConOferta(ofertasProveedor);
      const ofertasPrimeraRondaProveedor =
        primeraRondaProveedor != null
          ? ofertasProveedor.filter((o: any) => o.ronda === primeraRondaProveedor)
          : [];
      const totalInicial =
        ofertasPrimeraRondaProveedor.length > 0
          ? ofertasPrimeraRondaProveedor.reduce((sum: number, o: any) => {
              const item = itemsPorId.get(o.licitacionItemId);
              const subtotal = o.precioUnitario * (item?.cantidadSolicitada ?? 0);
              return sum + convertirAMoneda(subtotal, item?.moneda ?? "MXN", monedaConsolidacion, tiposCambio);
            }, 0)
          : null;

      // Sin `(o: any)`: ahora que ofertasProveedor tiene el tipo real de Prisma,
      // anotarlo como any hacía que new Set() devolviera Set<unknown> y todo lo
      // que colgaba de ahí perdiera el tipo en silencio.
      const itemIdsCotizados = [
        ...new Set(ofertasProveedor.map((o) => o.licitacionItemId)),
      ];
      const mejorTotalActual =
        itemIdsCotizados.length > 0
          ? itemIdsCotizados.reduce((sum: number, itemId: string) => {
              const item = itemsPorId.get(itemId);
              const preciosItem = ofertasProveedor
                .filter((o) => o.licitacionItemId === itemId)
                .map((o) => o.precioUnitario);
              const mejor = Math.min(...preciosItem);
              const subtotal = mejor * (item?.cantidadSolicitada ?? 0);
              return sum + convertirAMoneda(subtotal, item?.moneda ?? "MXN", monedaConsolidacion, tiposCambio);
            }, 0)
          : null;

      const variacionPct =
        totalInicial != null && mejorTotalActual != null && totalInicial > 0
          ? ((mejorTotalActual - totalInicial) / totalInicial) * 100
          : null;

      const rondasParticipadas = [
        ...new Set(ofertasProveedor.map((o) => o.ronda)),
      ].sort((a, b) => a - b);
      const ultimaRondaProveedor = rondasParticipadas[rondasParticipadas.length - 1];

      const historialRondas: RondaHistorial[] = rondasParticipadas.map((r) => {
        const ofertasEnRonda = ofertasProveedor.filter((o: any) => o.ronda === r);
        const totalCotizado = ofertasEnRonda.reduce((sum: number, o: any) => {
          const item = itemsPorId.get(o.licitacionItemId);
          const subtotal = o.precioUnitario * (item?.cantidadSolicitada ?? 0);
          return sum + convertirAMoneda(subtotal, item?.moneda ?? "MXN", monedaConsolidacion, tiposCambio);
        }, 0);
        const vsObjetivoMonto = totalCotizado - presupuestoObjetivoTotal;
        const vsObjetivoPct = (vsObjetivoMonto / presupuestoObjetivoSafe) * 100;
        const cercaniaPct =
          totalCotizado <= presupuestoObjetivoTotal
            ? 100
            : (presupuestoObjetivoSafe / totalCotizado) * 100;

        return {
          ronda: r,
          totalCotizado,
          vsObjetivoMonto,
          vsObjetivoPct,
          cercaniaPct,
          esActual: r === ultimaRondaProveedor,
        };
      });

      return {
        id: proveedorId,
        razonSocial: lp.proveedor.razonSocial,
        cotizó,
        ultimaCotizacion,
        totalInicial,
        mejorTotalActual,
        variacionPct,
        historialRondas,
        // `itemIdsCotizados` sale de ofertasProveedor, que ya viene filtrado por
        // soloOfertasValidas: las partidas marcadas "no dispongo" (y las que
        // quedaron en 0) no cuentan como cubiertas. Si esto queda por debajo del
        // total, el comprador ve el total marcado como INCOMPLETO.
        partidasCotizadas: itemIdsCotizados.length,
        partidasTotales: licitacion.items.length,
        ofertaDetalle: licitacion.items.map((item: any) => {
          const oferta = ofertasProveedorRondaActual.find(
            (o: any) => o.licitacionItemId === item.id
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

  const mejoresPrecioItems: MejorPrecioItem[] = licitacion.items.map((item: any) => {
    const itemOfertas = todasLasOfertas.filter(
      (o: any) => o.licitacionItemId === item.id
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

  // Payload del correo de invitación. Vivía inline aquí (~60 líneas), pero la
  // pantalla de lanzamiento necesita EL MISMO payload para notificar a una
  // licitación Programada, así que se mudó a src/lib/datosInvitacion.ts.
  // null solo si la licitación desapareció entre esta consulta y la de arriba.
  // No tumba la pantalla: DetalleLicitacion simplemente no ofrece el reenvío.
  const datosInvitacion = await getDatosInvitacion(id);

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
      analisisPorProducto={analisisPorProducto}
      resumenAhorro={resumenAhorro}
      basePath={basePath}
      codigoCliente={codigoCliente}
      datosInvitacion={datosInvitacion}
      noLeidosPorProveedor={noLeidosPorProveedor}
      notaTipoCambio={notaTC}
      faltanTiposCambio={faltanTC}
      monedaConsolidacion={monedaConsolidacion}
    />
  );
}
