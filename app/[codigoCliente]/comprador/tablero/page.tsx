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
  faltanTiposCambio,
  parseTiposCambio,
  MONEDA_BASE,
} from "@/src/lib/conversionMoneda";
import {
  filtrosDesdeSearchParams,
  itemPasaFiltro,
  resolverRangoFechas,
} from "@/src/lib/tableroFiltros";
import {
  getLicitacionesTablero,
  getOpcionesFiltros,
  getOrdenesTablero,
  type LicitacionItemTablero,
  type OrdenTablero,
} from "@/src/lib/tableroQueries";
import TableroView from "./_components/TableroView";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import type { TableroData } from "./_components/types";

// ── On-time delivery: definición del universo medible ────────────────────────
//
// Una orden solo puede medirse si (a) su entrega ya ocurrió, (b) había una
// fecha objetivo contra la cual comparar y (c) quedó registrada la fecha real.
// Las pendientes, en tránsito y canceladas no son incumplimientos: son órdenes
// que todavía no tienen resultado, y meterlas al denominador hundía el KPI.
// Las que no tienen fechaEstimadaEntrega tampoco cuentan — antes se daban por
// cumplidas, lo que inflaba el porcentaje: sin objetivo no hay nada que medir.
const ESTADOS_ENTREGA_CONCRETADA = ["Entregada", "Recibida"];

/**
 * Fecha real de entrega. Se prefiere fechaEntregada (cuándo llegó) sobre
 * fechaRecibida (cuándo se confirmó). NUNCA usar updatedAt: se mueve con
 * cualquier escritura posterior y degradaba el KPI con el tiempo.
 */
function fechaEntregaReal(oc: OrdenTablero): Date | null {
  return oc.fechaEntregada ?? oc.fechaRecibida ?? null;
}

function esOrdenMedible(oc: OrdenTablero): boolean {
  return (
    ESTADOS_ENTREGA_CONCRETADA.includes(oc.estado) &&
    oc.fechaEstimadaEntrega != null &&
    fechaEntregaReal(oc) != null
  );
}

/** Solo llamar sobre órdenes que ya pasaron esOrdenMedible(). */
function entregadaATiempo(oc: OrdenTablero): boolean {
  return fechaEntregaReal(oc)!.getTime() <= oc.fechaEstimadaEntrega!.getTime();
}

export default async function TableroIndicadoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigoCliente: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { codigoCliente } = await params;
  const sp = await searchParams;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const filtros = filtrosDesdeSearchParams(sp);
  const sesion = await getCompradorSession();
  const { startDate, endDate } = resolverRangoFechas(filtros);

  // Todas las consultas pasan por tableroQueries.ts — un solo `where` canónico
  // para licitaciones y órdenes, así ambos KPIs describen el mismo universo.
  const [opciones, licitaciones, ordenes] = await Promise.all([
    getOpcionesFiltros(filtros, sesion),
    getLicitacionesTablero(filtros, sesion),
    getOrdenesTablero(filtros, sesion),
  ]);

  // ── Cálculo unificado de ahorro / adherencia / precios ─────────────────────
  // Mismas fórmulas que el detalle de licitación (licitacionesAhorro.ts:
  // primeraRonda − mejorActual, adherencia = objetivo / mejorActual), y TODO
  // convertido a MXN (moneda base) con los tiposCambio congelados de cada
  // licitación. Una sola pasada alimenta el KPI de ahorro, el de adherencia,
  // la gráfica de precio inicial vs final y la de ahorro por material.
  let licitacionesTotales = 0;
  let ahorroTotal = 0; // Σ ahorro (MXN), mismo signo que el detalle
  let objetivoAcumMXN = 0; // numerador de la adherencia global
  let mejorAcumMXN = 0; // denominador de la adherencia global
  const precioChart: TableroData["precioChart"] = [];
  const avisoTiposCambio: string[] = [];

  type MaterialAcc = {
    productoId: string;
    productoCodigo: string;
    productoNombre: string;
    familia: string | null;
    cantidadTotal: number;
    primeraRondaSumMXN: number;
    mejorSumMXN: number;
    ahorroSumMXN: number;
  };
  const matMap = new Map<string, MaterialAcc>();

  const jerMap = new Map<
    string,
    { licitaciones: number; dentro: number; fuera: number }
  >();

  for (const lic of licitaciones) {
    // NIVEL 2 del filtrado: el `where` de Prisma ya descartó las licitaciones
    // sin ningún material que califique, pero las que entraron pueden traer
    // materiales que NO califican. Si se calculara sobre lic.items completo,
    // filtrar por familia "TI" mostraría el ahorro de toda la licitación
    // etiquetado como ahorro de TI.
    const items: LicitacionItemTablero[] = lic.items.filter((it) =>
      itemPasaFiltro(
        {
          productoId: it.productoId,
          familia: it.producto.familia,
          productoEliminado: it.producto.eliminado,
        },
        filtros
      )
    );
    if (items.length === 0) continue;

    licitacionesTotales++;

    const itemsAhorro: LicitacionItemParaAhorro[] = items.map((it) => ({
      id: it.id,
      cantidadSolicitada: it.cantidadSolicitada,
      precioObjetivo: it.precioObjetivo,
      moneda: it.moneda,
    }));
    const ofertasAhorro: OfertaParaAhorro[] = items.flatMap((it) =>
      it.ofertas.map((o) => ({
        licitacionItemId: it.id,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
      }))
    );

    const tiposCambio = parseTiposCambio(lic.tiposCambio);

    // Regla 4: avisar cuando falte el TC de alguna moneda en uso. Sin esto la
    // conversión cae a tasa 1 (retrocompatibilidad de conversionMoneda.ts) y
    // los importes en moneda extranjera se suman como si fueran MXN, en
    // silencio y por debajo de su valor real.
    if (faltanTiposCambio(items.map((it) => it.moneda), tiposCambio, MONEDA_BASE)) {
      avisoTiposCambio.push(lic.numero);
    }

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
    // Se indexa por licitacionItemId en vez de por posición: el pareo
    // analisis[i] ↔ items[i] se rompe en silencio en cuanto uno de los dos
    // arrays se filtra, que es exactamente lo que hace el nivel 2 de arriba.
    const itemPorId = new Map(items.map((it) => [it.id, it]));
    for (const a of analisis) {
      if (a.ahorroTotal == null) continue; // material sin puja → fuera del ahorro
      const it = itemPorId.get(a.licitacionItemId);
      if (!it) continue;

      const toMXN = (v: number) =>
        convertirAMoneda(v, a.moneda, MONEDA_BASE, tiposCambio);

      const acc = matMap.get(it.productoId) ?? {
        productoId: it.productoId,
        productoCodigo: it.producto.codigo,
        productoNombre: it.producto.nombre,
        familia: it.producto.familia?.trim() ? it.producto.familia.trim() : null,
        cantidadTotal: 0,
        primeraRondaSumMXN: 0,
        mejorSumMXN: 0,
        ahorroSumMXN: 0,
      };
      acc.cantidadTotal += a.cantidadSolicitada;
      acc.primeraRondaSumMXN += toMXN(a.primeraRondaTotal ?? 0);
      acc.mejorSumMXN += toMXN(a.mejorActualTotal ?? 0);
      acc.ahorroSumMXN += toMXN(a.ahorroTotal);
      matMap.set(it.productoId, acc);
    }

    // Gráfica: adherencia por criticidad. Compara unitario vs unitario en la
    // moneda del propio material, así que no requiere conversión.
    const claveJerarquia = lic.jerarquia || "Sin criticidad";
    const entradaJer = jerMap.get(claveJerarquia) ?? {
      licitaciones: 0,
      dentro: 0,
      fuera: 0,
    };
    entradaJer.licitaciones++;
    for (const item of items) {
      if (!item.precioObjetivo || item.ofertas.length === 0) continue;
      const minOferta = Math.min(...item.ofertas.map((o) => o.precioUnitario));
      if (minOferta <= item.precioObjetivo) entradaJer.dentro++;
      else entradaJer.fuera++;
    }
    jerMap.set(claveJerarquia, entradaJer);
  }

  const adherenciaPrecios: number | null =
    mejorAcumMXN > 0
      ? Math.round((objetivoAcumMXN / mejorAcumMXN) * 1000) / 10
      : null;

  const ahorroMaterial: TableroData["ahorroMaterial"] = Array.from(matMap.values())
    .filter((m) => m.ahorroSumMXN > 0)
    .sort((a, b) => b.ahorroSumMXN - a.ahorroSumMXN)
    .map((m) => ({
      productoId: m.productoId,
      productoCodigo: m.productoCodigo,
      productoNombre: m.productoNombre,
      familia: m.familia,
      cantidadTotal: m.cantidadTotal,
      precioPrimeraRondaPromedio:
        m.cantidadTotal > 0 ? m.primeraRondaSumMXN / m.cantidadTotal : 0,
      precioMejorPromedio: m.cantidadTotal > 0 ? m.mejorSumMXN / m.cantidadTotal : 0,
      ahorroTotal: m.ahorroSumMXN,
    }));

  const adherenciaJerarquia: TableroData["adherenciaJerarquia"] = Array.from(
    jerMap.entries()
  )
    .map(([jerarquia, d]) => ({
      jerarquia,
      licitaciones: d.licitaciones,
      itemsDentro: d.dentro,
      itemsFuera: d.fuera,
      porcentaje:
        d.dentro + d.fuera > 0
          ? Math.round((d.dentro / (d.dentro + d.fuera)) * 100)
          : 0,
    }))
    .sort((a, b) => b.licitaciones - a.licitaciones);

  // ── KPI: On-time delivery ─────────────────────────────────────────────────
  const ordenesMedibles = ordenes.filter(esOrdenMedible);
  const aTiempoTotal = ordenesMedibles.filter(entregadaATiempo).length;
  const onTimeDelivery: number | null =
    ordenesMedibles.length > 0
      ? Math.round((aTiempoTotal / ordenesMedibles.length) * 100)
      : null;

  // ── Gráfica: on-time por proveedor (mismo universo medible) ───────────────
  const provMap = new Map<
    string,
    { nombre: string; total: number; aTiempo: number; tardias: number }
  >();
  for (const oc of ordenesMedibles) {
    const entrada = provMap.get(oc.proveedor.id) ?? {
      nombre: oc.proveedor.razonSocial,
      total: 0,
      aTiempo: 0,
      tardias: 0,
    };
    entrada.total++;
    if (entregadaATiempo(oc)) entrada.aTiempo++;
    else entrada.tardias++;
    provMap.set(oc.proveedor.id, entrada);
  }
  const onTimeProveedor: TableroData["onTimeProveedor"] = Array.from(
    provMap.values()
  )
    .map((p) => ({
      proveedorNombre: p.nombre,
      totalOC: p.total,
      aTiempo: p.aTiempo,
      tardias: p.tardias,
      porcentaje: Math.round((p.aTiempo / p.total) * 100),
    }))
    .sort((a, b) => b.porcentaje - a.porcentaje);

  // ── Compose and render ────────────────────────────────────────────────────
  const data: TableroData = {
    kpis: { licitacionesTotales, ahorroTotal, adherenciaPrecios, onTimeDelivery },
    precioChart,
    ahorroMaterial,
    onTimeProveedor,
    adherenciaJerarquia,
    proveedoresOpciones: opciones.proveedores,
    jerarquiasOpciones: opciones.jerarquias,
    familiasOpciones: opciones.familias,
    productosOpciones: opciones.productos,
    hayProductosSinFamilia: opciones.hayProductosSinFamilia,
    avisoTiposCambio,
    periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  };

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Tablero de Indicadores" />
      <TableroView data={data} filtros={filtros} basePath={basePath} />
    </div>
  );
}
