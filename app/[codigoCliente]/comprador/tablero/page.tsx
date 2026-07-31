import { prisma } from "@/src/lib/prisma";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCompradorSession } from "@/src/lib/compradorSession";
import {
  calcularAnalisisPorItem,
  calcularResumenAhorro,
  type LicitacionItemParaAhorro,
  type OfertaParaAhorro,
} from "@/src/lib/licitacionesAhorro";
import {
  convertirAMoneda,
  parseTiposCambio,
  MONEDA_BASE,
} from "@/src/lib/conversionMoneda";
import TableroView from "./_components/TableroView";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import type { TableroData, FiltrosActivos } from "./_components/types";

const db = prisma as any;

function getDateRange(
  period: string,
  dateFrom?: string,
  dateTo?: string
): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = dateTo ? new Date(dateTo + "T23:59:59") : now;
  let startDate: Date;
  switch (period) {
    case "last_month":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "last_3_months":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "custom":
      startDate = dateFrom
        ? new Date(dateFrom + "T00:00:00")
        : new Date(now.getTime() - 7 * 86_400_000);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
  }
  return { startDate, endDate };
}

export default async function TableroIndicadoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigoCliente: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { codigoCliente } = await params;
  const sp = await searchParams;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const period = sp.period || "last_week";
  const proveedorId = sp.proveedor || undefined;
  const jerarquia = sp.jerarquia || undefined;
  const { startDate, endDate } = getDateRange(period, sp.dateFrom, sp.dateTo);

  // ── Filter option lists ───────────────────────────────────────────────────
  const [proveedoresRaw, jerarquiasRaw] = await Promise.all([
    db.proveedor.findMany({
      where: { eliminado: false, estado: "Activo" },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: "asc" },
    }),
    db.licitacion.findMany({
      where: {
        eliminado: false,
        jerarquia: { not: null },
        ...(puedeVerTodo ? {} : { compradorId }),
      },
      select: { jerarquia: true },
      distinct: ["jerarquia"],
    }),
  ]);

  const proveedoresOpciones: TableroData["proveedoresOpciones"] = proveedoresRaw.map(
    (p: any) => ({ id: p.id, nombre: p.razonSocial })
  );
  const jerarquiasOpciones: string[] = jerarquiasRaw
    .map((l: any) => l.jerarquia)
    .filter(Boolean)
    .sort();

  // ── Main queries ──────────────────────────────────────────────────────────
  const licitWhere: any = {
    eliminado: false,
    ...(puedeVerTodo ? {} : { compradorId }),
    fechaCreacion: { gte: startDate, lte: endDate },
    ...(jerarquia ? { jerarquia } : {}),
    ...(proveedorId ? { proveedoresInvitados: { some: { proveedorId } } } : {}),
  };

  const ordenesWhere: any = {
    fechaCreacion: { gte: startDate, lte: endDate },
    ...(puedeVerTodo && !jerarquia
      ? {}
      : {
          licitacion: {
            ...(puedeVerTodo ? {} : { compradorId }),
            ...(jerarquia ? { jerarquia } : {}),
          },
        }),
    ...(proveedorId ? { proveedorId } : {}),
  };

  const [licitaciones, ordenes] = await Promise.all([
    db.licitacion.findMany({
      where: licitWhere,
      include: {
        // Los escalares de Licitacion (tiposCambio, numero, jerarquia…) y de
        // LicitacionItem (id, moneda, precioObjetivo, cantidadSolicitada) se
        // incluyen automáticamente con `include`. El ahorro se calcula desde
        // las ofertas (no desde asignaciones), igual que el detalle.
        items: {
          include: {
            producto: { select: { nombre: true, familia: true } },
            ofertas: { select: { precioUnitario: true, ronda: true } },
          },
        },
      },
      orderBy: { numero: "asc" },
    }),
    db.ordenCompra.findMany({
      where: ordenesWhere,
      include: {
        proveedor: { select: { razonSocial: true } },
      },
    }),
  ]);

  // ── KPI 1: Licitaciones totales ───────────────────────────────────────────
  const licitacionesTotales: number = licitaciones.length;

  // ── Cálculo unificado de ahorro / adherencia / precios ─────────────────────
  // Mismas fórmulas que el detalle de licitación (licitacionesAhorro.ts:
  // primeraRonda − mejorActual, adherencia = objetivo / mejorActual), y TODO
  // convertido a MXN (moneda base) con los tiposCambio congelados de cada
  // licitación. Una sola pasada alimenta el KPI de ahorro, el de adherencia,
  // la gráfica de precio inicial vs final y la de ahorro por material.
  let ahorroTotal = 0; // Σ ahorro (MXN), mismo signo que el detalle
  let objetivoAcumMXN = 0; // numerador de la adherencia global
  let mejorAcumMXN = 0; // denominador de la adherencia global
  const precioChart: TableroData["precioChart"] = [];

  type MaterialAcc = {
    productoNombre: string;
    familia: string | null;
    cantidadTotal: number;
    primeraRondaSumMXN: number;
    mejorSumMXN: number;
    ahorroSumMXN: number;
  };
  const matMap = new Map<string, MaterialAcc>();

  for (const lic of licitaciones) {
    const itemsAhorro: LicitacionItemParaAhorro[] = lic.items.map((it: any) => ({
      id: it.id,
      cantidadSolicitada: it.cantidadSolicitada,
      precioObjetivo: it.precioObjetivo,
      moneda: it.moneda,
    }));
    const ofertasAhorro: OfertaParaAhorro[] = lic.items.flatMap((it: any) =>
      it.ofertas.map((o: any) => ({
        licitacionItemId: it.id,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
      }))
    );

    const tiposCambio = parseTiposCambio(lic.tiposCambio);
    const analisis = calcularAnalisisPorItem(itemsAhorro, ofertasAhorro);
    const resumen = calcularResumenAhorro(
      analisis,
      ofertasAhorro.length > 0,
      tiposCambio,
      MONEDA_BASE
    );

    // KPI ahorro (MXN) y adherencia global (Σobjetivo / Σmejor).
    ahorroTotal += resumen.ahorroTotal;
    if (resumen.hayOfertas && resumen.mejorPrecioActualTotal > 0) {
      objetivoAcumMXN += resumen.presupuestoObjetivoTotal;
      mejorAcumMXN += resumen.mejorPrecioActualTotal;
    }

    // Gráfica: precio primera ronda vs mejor precio (MXN) por licitación.
    if (resumen.hayOfertas && resumen.primeraRondaTotal > 0) {
      precioChart.push({
        numero: lic.numero,
        jerarquia: lic.jerarquia ?? null,
        precioInicial: resumen.primeraRondaTotal,
        precioFinal: resumen.mejorPrecioActualTotal,
        ahorro: resumen.ahorroTotal,
        ahorroPercent:
          resumen.ahorroPct != null ? Math.round(resumen.ahorroPct * 10) / 10 : 0,
      });
    }

    // Gráfica: ahorro por material (MXN), misma definición que el detalle.
    for (let i = 0; i < analisis.length; i++) {
      const a = analisis[i];
      if (a.ahorroTotal == null) continue; // material sin puja → fuera del ahorro
      const it = lic.items[i];
      const nombre: string = it.producto.nombre;
      const toMXN = (v: number) => convertirAMoneda(v, a.moneda, MONEDA_BASE, tiposCambio);

      const acc = matMap.get(nombre) ?? {
        productoNombre: nombre,
        familia: (it.producto.familia ?? null) as string | null,
        cantidadTotal: 0,
        primeraRondaSumMXN: 0,
        mejorSumMXN: 0,
        ahorroSumMXN: 0,
      };
      acc.cantidadTotal += a.cantidadSolicitada;
      acc.primeraRondaSumMXN += toMXN(a.primeraRondaTotal ?? 0);
      acc.mejorSumMXN += toMXN(a.mejorActualTotal ?? 0);
      acc.ahorroSumMXN += toMXN(a.ahorroTotal);
      matMap.set(nombre, acc);
    }
  }

  const adherenciaPrecios: number | null =
    mejorAcumMXN > 0 ? Math.round((objetivoAcumMXN / mejorAcumMXN) * 1000) / 10 : null;

  const ahorroMaterial: TableroData["ahorroMaterial"] = Array.from(matMap.values())
    .filter((m) => m.ahorroSumMXN > 0)
    .sort((a, b) => b.ahorroSumMXN - a.ahorroSumMXN)
    .map((m) => ({
      productoNombre: m.productoNombre,
      familia: m.familia,
      cantidadTotal: m.cantidadTotal,
      precioPrimeraRondaPromedio: m.cantidadTotal > 0 ? m.primeraRondaSumMXN / m.cantidadTotal : 0,
      precioMejorPromedio: m.cantidadTotal > 0 ? m.mejorSumMXN / m.cantidadTotal : 0,
      ahorroTotal: m.ahorroSumMXN,
    }));

  // ── KPI 4: On-time delivery ───────────────────────────────────────────────
  const entregadas = ordenes.filter((o: any) =>
    ["Entregada", "Recibida"].includes(o.estado)
  );
  let aTiempoTotal = 0;
  for (const oc of entregadas) {
    if (
      !oc.fechaEstimadaEntrega ||
      new Date(oc.updatedAt) <= new Date(oc.fechaEstimadaEntrega)
    ) {
      aTiempoTotal++;
    }
  }
  const onTimeDelivery: number | null =
    ordenes.length > 0
      ? Math.round((aTiempoTotal / ordenes.length) * 100)
      : null;

  // ── Graph 3: On-time delivery por proveedor ───────────────────────────────
  const provMap = new Map<
    string,
    { nombre: string; total: number; aTiempo: number; tardias: number }
  >();
  for (const oc of ordenes) {
    const nombre: string = oc.proveedor.razonSocial;
    const e = provMap.get(nombre) ?? { nombre, total: 0, aTiempo: 0, tardias: 0 };
    e.total++;
    if (["Entregada", "Recibida"].includes(oc.estado)) {
      if (
        !oc.fechaEstimadaEntrega ||
        new Date(oc.updatedAt) <= new Date(oc.fechaEstimadaEntrega)
      ) {
        e.aTiempo++;
      } else {
        e.tardias++;
      }
    }
    provMap.set(nombre, e);
  }
  const onTimeProveedor: TableroData["onTimeProveedor"] = Array.from(provMap.values())
    .map((p: any)=> ({
      proveedorNombre: p.nombre,
      totalOC: p.total,
      aTiempo: p.aTiempo,
      tardias: p.tardias,
      porcentaje: Math.round((p.aTiempo / p.total) * 100),
    }))
    .sort((a: any, b: any) => b.porcentaje - a.porcentaje);

  // ── Graph 4: Adherencia por jerarquía ─────────────────────────────────────
  const jerMap = new Map<string, { licitaciones: number; dentro: number; fuera: number }>();
  for (const lic of licitaciones) {
    const key: string = lic.jerarquia || "Sin categoría";
    const e = jerMap.get(key) ?? { licitaciones: 0, dentro: 0, fuera: 0 };
    e.licitaciones++;
    for (const item of lic.items) {
      if (!item.precioObjetivo || !item.ofertas.length) continue;
      const minOferta = Math.min(...item.ofertas.map((o: any) => o.precioUnitario));
      if (minOferta <= item.precioObjetivo) e.dentro++;
      else e.fuera++;
    }
    jerMap.set(key, e);
  }
  const adherenciaJerarquia: TableroData["adherenciaJerarquia"] = Array.from(
    jerMap.entries()
  )
    .map(([jer, d]) => ({
      jerarquia: jer,
      licitaciones: d.licitaciones,
      itemsDentro: d.dentro,
      itemsFuera: d.fuera,
      porcentaje:
        d.dentro + d.fuera > 0
          ? Math.round((d.dentro / (d.dentro + d.fuera)) * 100)
          : 0,
    }))
    .sort((a: any, b: any) => b.licitaciones - a.licitaciones);

  // ── Compose and render ────────────────────────────────────────────────────
  const data: TableroData = {
    kpis: { licitacionesTotales, ahorroTotal, adherenciaPrecios, onTimeDelivery },
    precioChart,
    ahorroMaterial,
    onTimeProveedor,
    adherenciaJerarquia,
    proveedoresOpciones,
    jerarquiasOpciones,
    periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  };

  const filtros: FiltrosActivos = {
    period,
    proveedorId: proveedorId ?? "",
    jerarquia: jerarquia ?? "",
    dateFrom: sp.dateFrom ?? "",
    dateTo: sp.dateTo ?? "",
  };

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Tablero de Indicadores" />
      <TableroView data={data} filtros={filtros} basePath={basePath} />
    </div>
  );
}
