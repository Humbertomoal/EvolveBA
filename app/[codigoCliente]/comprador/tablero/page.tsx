import { prisma } from "@/src/lib/prisma";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCompradorSession } from "@/src/lib/compradorSession";
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
        items: {
          include: {
            producto: { select: { nombre: true, familia: true } },
            ofertas: { select: { precioUnitario: true, ronda: true } },
            asignaciones: {
              select: { precioUnitario: true, cantidadAsignada: true },
            },
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

  // ── KPI 2: Ahorro total ───────────────────────────────────────────────────
  let ahorroTotal = 0;
  for (const lic of licitaciones) {
    for (const item of lic.items) {
      const obj = item.precioObjetivo ?? 0;
      for (const a of item.asignaciones) {
        const s = (obj - a.precioUnitario) * a.cantidadAsignada;
        if (s > 0) ahorroTotal += s;
      }
    }
  }

  // ── KPI 3: Adherencia de precios ──────────────────────────────────────────
  let conObj = 0;
  let adherentes = 0;
  for (const lic of licitaciones) {
    for (const item of lic.items) {
      if (!item.precioObjetivo || !item.ofertas.length) continue;
      conObj++;
      const minOferta = Math.min(...item.ofertas.map((o: any) => o.precioUnitario));
      if (minOferta <= item.precioObjetivo) adherentes++;
    }
  }
  const adherenciaPrecios: number | null =
    conObj > 0 ? Math.round((adherentes / conObj) * 100) : null;

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

  // ── Graph 1: Precio inicial vs final por licitación ───────────────────────
  const precioChart: TableroData["precioChart"] = [];
  for (const lic of licitaciones) {
    let inicialTotal = 0;
    let finalTotal = 0;
    let tieneData = false;
    for (const item of lic.items) {
      const ronda1 = item.ofertas.filter((o: any) => o.ronda === 1);
      if (!ronda1.length || !item.asignaciones.length) continue;
      tieneData = true;
      const minR1 = Math.min(...ronda1.map((o: any) => o.precioUnitario));
      inicialTotal += minR1 * (item.cantidadSolicitada || 0);
      for (const a of item.asignaciones) {
        finalTotal += a.precioUnitario * a.cantidadAsignada;
      }
    }
    if (tieneData && inicialTotal > 0) {
      const ahorro = inicialTotal - finalTotal;
      precioChart.push({
        numero: lic.numero,
        jerarquia: lic.jerarquia ?? null,
        precioInicial: inicialTotal,
        precioFinal: finalTotal,
        ahorro,
        ahorroPercent: Math.round((ahorro / inicialTotal) * 1000) / 10,
      });
    }
  }

  // ── Graph 2: Ahorro por material ──────────────────────────────────────────
  const matMap = new Map<
    string,
    {
      productoNombre: string;
      familia: string | null;
      cantidadTotal: number;
      objSum: number;
      adjSum: number;
      adjCant: number;
      ahorroTotal: number;
    }
  >();
  for (const lic of licitaciones) {
    for (const item of lic.items) {
      if (!item.asignaciones.length) continue;
      const nombre: string = item.producto.nombre;
      const e = matMap.get(nombre) ?? {
        productoNombre: nombre,
        familia: item.producto.familia ?? null,
        cantidadTotal: 0,
        objSum: 0,
        adjSum: 0,
        adjCant: 0,
        ahorroTotal: 0,
      };
      e.cantidadTotal += item.cantidadSolicitada || 0;
      for (const a of item.asignaciones) {
        const obj = item.precioObjetivo ?? a.precioUnitario;
        e.objSum += obj * a.cantidadAsignada;
        e.adjSum += a.precioUnitario * a.cantidadAsignada;
        e.adjCant += a.cantidadAsignada;
        e.ahorroTotal += (obj - a.precioUnitario) * a.cantidadAsignada;
      }
      matMap.set(nombre, e);
    }
  }
  const ahorroMaterial: TableroData["ahorroMaterial"] = Array.from(matMap.values())
    .filter((m) => m.ahorroTotal > 0)
    .sort((a: any, b: any) => b.ahorroTotal - a.ahorroTotal)
    .map((m) => ({
      productoNombre: m.productoNombre,
      familia: m.familia,
      cantidadTotal: m.cantidadTotal,
      precioObjetivoPromedio: m.adjCant > 0 ? m.objSum / m.adjCant : 0,
      precioAdjudicadoPromedio: m.adjCant > 0 ? m.adjSum / m.adjCant : 0,
      ahorroTotal: m.ahorroTotal,
    }));

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
