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
  claveMes,
  etiquetaMes,
  filtrosDesdeSearchParams,
  itemPasaFiltro,
  resolverRangoFechas,
} from "@/src/lib/tableroFiltros";
import { promediarEtapas } from "@/src/lib/tableroEtapas";
import {
  acumularPonderado,
  asignacionCuenta,
  construirPareto,
  dentroDe,
  esVentanaValida,
  fechaDeCompra,
  inicioMasAntiguo,
  mesesEntre,
  productoTopPorMonto,
  promedioPonderado,
  resolverVentana,
  type VentanaHistorico,
} from "@/src/lib/tableroHistorico";
import {
  CATEGORIAS_PIPELINE,
  ESTADO_OC_PENDIENTE,
  LABEL_CATEGORIA,
  clasificarLicitacion,
  duracionMsCategoria,
  entradaAlEstadoActual,
  type CategoriaLicitacion,
} from "@/src/lib/tableroCategorias";
import {
  esLicitacionEjecutada,
  getEtapasTablero,
  getLicitacionesHistorico,
  getLicitacionesPipeline,
  getLicitacionesTablero,
  getOpcionesFiltros,
  getOrdenesTablero,
  type LicitacionItemTablero,
  type OrdenTablero,
} from "@/src/lib/tableroQueries";
import { mejorOfertaValida, soloOfertasValidas } from "@/src/lib/ofertaValida";
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
  // Ventanas propias del Grupo 3. Se saneen aquí: un valor inválido en la URL
  // cae al prefiltro en vez de romper el cálculo.
  const ahora = new Date();
  const ventanaDe = (valor: string, porDefecto: VentanaHistorico): VentanaHistorico =>
    esVentanaValida(valor) ? valor : porDefecto;

  const vAhorro = ventanaDe(filtros.perAhorro, "6m");
  const vMonto = ventanaDe(filtros.perMonto, "mes_anterior");
  const vTop3 = ventanaDe(filtros.perTop3, "mes_anterior");
  const vCosto = ventanaDe(filtros.perCosto, "6m");
  const vVariacion = ventanaDe(filtros.perVariacion, "12m");

  // UNA sola query para los cinco indicadores: se pide la ventana más ancha y
  // cada uno recorta en memoria. Cinco ventanas ≠ cinco viajes a la BD.
  const desdeHistorico = inicioMasAntiguo(
    [vAhorro, vMonto, vTop3, vCosto, vVariacion],
    ahora
  );

  const [opciones, licitaciones, ordenes, etapasRaw, pipelineRaw, historicoRaw] =
    await Promise.all([
      getOpcionesFiltros(filtros, sesion),
      getLicitacionesTablero(filtros, sesion),
      getOrdenesTablero(filtros, sesion),
      getEtapasTablero(filtros, sesion),
      getLicitacionesPipeline(filtros, sesion),
      getLicitacionesHistorico(filtros, sesion, desdeHistorico),
    ]);

  // ── Cálculo unificado de ahorro / adherencia / precios ─────────────────────
  // Mismas fórmulas que el detalle de licitación (licitacionesAhorro.ts:
  // primeraRonda − mejorActual, adherencia = objetivo / mejorActual), y TODO
  // convertido a MXN (moneda base) con los tiposCambio congelados de cada
  // licitación. Una sola pasada alimenta el KPI de ahorro, el de adherencia,
  // la gráfica de precio inicial vs final y la de ahorro por material.
  let licitacionesTotales = 0;
  let objetivoAcumMXN = 0; // numerador de la adherencia global
  let mejorAcumMXN = 0; // denominador de la adherencia global
  const precioChart: TableroData["precioChart"] = [];
  const avisoTiposCambio: string[] = [];

  // ── Grupo 1: solo licitaciones EJECUTADAS ──────────────────────────────────
  // El universo es más estrecho que el de los indicadores de arriba: aquí solo
  // entran las licitaciones cuya puja ya terminó y cuyos precios no se mueven.
  let licitacionesEjecutadas = 0;
  let valorPrimeraRonda = 0; // MXN, a precios de la primera ronda CON puja
  let valorMejoresPrecios = 0; // MXN, al mejor precio de todas las rondas
  const ahorroPorMes = new Map<string, number>();

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
        proveedorId: o.proveedorId,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
        noDisponible: o.noDisponible,
        noAplica: o.noAplica,
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

    // Adherencia global (Σobjetivo / Σmejor).
    if (resumen.hayOfertas && resumen.mejorPrecioActualTotal > 0) {
      objetivoAcumMXN += resumen.presupuestoObjetivoTotal;
      mejorAcumMXN += resumen.mejorPrecioActualTotal;
    }

    // ── Universo del AHORRO: licitaciones ejecutadas con ofertas ────────────
    // Una sola condición para la tarjeta, la gráfica mensual, la de precio
    // inicial vs final y la de ahorro por material. Vive en una constante y no
    // repetida en cada bloque a propósito: son cuatro vistas del mismo número y
    // si las condiciones se escriben por separado terminan divergiendo.
    // Ojo: NO aplica a adherencia ni a on-time, que miden otra cosa y tienen su
    // propio universo (todas las licitaciones filtradas / órdenes medibles).
    const entraAlAhorro = esLicitacionEjecutada(lic.estado) && resumen.hayOfertas;

    // ── Indicadores 1-3 del Grupo 1 ─────────────────────────────────────────
    // Salen del mismo `resumen` que ya se calculó: primeraRondaTotal es el
    // valor a precios de la primera ronda CON puja (no necesariamente la ronda
    // 1) y mejorPrecioActualTotal el del mejor precio de todas las rondas,
    // ambos ya consolidados a MXN con el TC congelado de la licitación.
    if (entraAlAhorro) {
      licitacionesEjecutadas++;
      valorPrimeraRonda += resumen.primeraRondaTotal;
      valorMejoresPrecios += resumen.mejorPrecioActualTotal;

      // El ahorro se materializa cuando se congela el precio, o sea al cerrar.
      const fechaCorte =
        lic.fechaCerrada ?? lic.fechaFinalizada ?? lic.fechaCreacion;
      const mes = claveMes(fechaCorte);
      ahorroPorMes.set(mes, (ahorroPorMes.get(mes) ?? 0) + resumen.ahorroTotal);
    }

    // Gráfica: precio primera ronda vs mejor precio (MXN) por licitación.
    if (entraAlAhorro && resumen.primeraRondaTotal > 0) {
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
      // Sin el filtro, una oferta en 0 siempre cumplía `minOferta <= objetivo`
      // y el material se contaba como "dentro de objetivo" aunque nadie lo
      // hubiera cotizado de verdad.
      const ofertasValidas = soloOfertasValidas(item.ofertas);
      if (!item.precioObjetivo || ofertasValidas.length === 0) continue;
      const minOferta = Math.min(...ofertasValidas.map((o) => o.precioUnitario));
      if (minOferta <= item.precioObjetivo) entradaJer.dentro++;
      else entradaJer.fuera++;
    }
    jerMap.set(claveJerarquia, entradaJer);
  }

  const adherenciaPrecios: number | null =
    mejorAcumMXN > 0
      ? Math.round((objetivoAcumMXN / mejorAcumMXN) * 1000) / 10
      : null;

  // Se resta el total de totales (en vez de sumar los ahorros por licitación)
  // para que la resta de las tres tarjetas cierre exacta en pantalla: sumar
  // Σ(aᵢ−bᵢ) puede desviarse de Σaᵢ−Σbᵢ en los últimos bits del flotante.
  const ahorroTotal = valorPrimeraRonda - valorMejoresPrecios;

  const ahorroMensual: TableroData["ahorroMensual"] = Array.from(
    ahorroPorMes.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, ahorro]) => ({ mes, etiqueta: etiquetaMes(mes), ahorro }));

  // Tiempo por etapa: el algoritmo (suma por licitación antes de promediar,
  // huecos descartados, último estado sin cerrar) vive en tableroEtapas.ts.
  const resumenEtapas = promediarEtapas(etapasRaw.logsPorLicitacion);
  const tiempoEtapas: TableroData["tiempoEtapas"] = {
    etapas: resumenEtapas.etapas,
    licitacionesUtilizables: resumenEtapas.licitacionesUtilizables,
    licitacionesTotales: etapasRaw.licitacionesTotales,
    intervalosDescartados: resumenEtapas.intervalosDescartados,
  };

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

  // ── Grupo 2: pipeline (foto del estado ACTUAL) ────────────────────────────
  // Universo distinto al de arriba: getLicitacionesPipeline ignora el filtro de
  // periodo a propósito (ver comentario en construirWhereLicitacion).
  type AccCategoria = { cantidad: number; sumaMs: number; conDuracion: number };
  const nuevaAcc = (): AccCategoria => ({ cantidad: 0, sumaMs: 0, conDuracion: 0 });

  const porCategoria = new Map<CategoriaLicitacion, AccCategoria>();
  // mes → categoría → acumulado
  const mesCategoria = new Map<string, Map<CategoriaLicitacion, AccCategoria>>();
  let entradasExactas = 0;
  let entradasTotales = 0;

  // "Cerradas sin OC enviada": Finalizada con al menos una OC en "Pendiente".
  // Es un SUBCONJUNTO de Terminadas, no una categoría más — por eso se acumula
  // aparte y no entra en la suma de los tiles.
  const sinOc = nuevaAcc();
  const sinOcMes = new Map<string, AccCategoria>();

  for (const lic of pipelineRaw) {
    const categoria = clasificarLicitacion(lic);
    if (!categoria) continue; // estado desconocido → fuera, y se nota al no cuadrar

    const ultimoLog = lic.estadoLogs[0]?.at ?? null;
    const entrada = entradaAlEstadoActual(lic, ultimoLog);
    entradasTotales++;
    if (entrada.exacta) entradasExactas++;

    const ms = duracionMsCategoria(categoria, lic, entrada.fecha, ahora);

    const acc = porCategoria.get(categoria) ?? nuevaAcc();
    acc.cantidad++;
    if (ms != null) {
      acc.sumaMs += ms;
      acc.conDuracion++;
    }
    porCategoria.set(categoria, acc);

    // Bucket mensual: para las categorías en curso, el mes de ENTRADA al estado
    // (queda una distribución de antigüedad); para las terminales, su desenlace
    // ya es la fecha de entrada, así que la misma clave sirve.
    const mes = claveMes(entrada.fecha);
    const delMes = mesCategoria.get(mes) ?? new Map<CategoriaLicitacion, AccCategoria>();
    const accMes = delMes.get(categoria) ?? nuevaAcc();
    accMes.cantidad++;
    if (ms != null) {
      accMes.sumaMs += ms;
      accMes.conDuracion++;
    }
    delMes.set(categoria, accMes);
    mesCategoria.set(mes, delMes);

    if (categoria === "terminadas") {
      const pendientes = lic.ordenes.filter((o) => o.estado === ESTADO_OC_PENDIENTE);
      if (pendientes.length > 0) {
        // La OC pendiente MÁS ANTIGUA marca cuánto lleva atorado el envío.
        const desde = pendientes
          .map((o) => o.fechaPendiente ?? o.fechaCreacion)
          .reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
        const msAtorada = ahora.getTime() - desde.getTime();

        sinOc.cantidad++;
        if (msAtorada >= 0) {
          sinOc.sumaMs += msAtorada;
          sinOc.conDuracion++;
        }

        const mesOc = claveMes(desde);
        const accOc = sinOcMes.get(mesOc) ?? nuevaAcc();
        accOc.cantidad++;
        if (msAtorada >= 0) {
          accOc.sumaMs += msAtorada;
          accOc.conDuracion++;
        }
        sinOcMes.set(mesOc, accOc);
      }
    }
  }

  const MS_POR_HORA = 3_600_000;
  const promedioHoras = (acc: AccCategoria | undefined): number | null =>
    acc && acc.conDuracion > 0
      ? Math.round((acc.sumaMs / acc.conDuracion / MS_POR_HORA) * 10) / 10
      : null;

  const mesesPipeline = [...mesCategoria.keys()].sort((a, b) => a.localeCompare(b));

  const pipeline: TableroData["pipeline"] = {
    categorias: CATEGORIAS_PIPELINE.map((clave) => ({
      clave,
      label: LABEL_CATEGORIA[clave],
      cantidad: porCategoria.get(clave)?.cantidad ?? 0,
      tiempoPromedioHoras: promedioHoras(porCategoria.get(clave)),
    })),
    sinOcEnviada: {
      cantidad: sinOc.cantidad,
      tiempoPromedioHoras: promedioHoras(sinOc),
    },
    cantidadPorMes: mesesPipeline.map((mes) => {
      const delMes = mesCategoria.get(mes);
      const porCat: Record<string, number> = {};
      for (const clave of CATEGORIAS_PIPELINE) {
        porCat[clave] = delMes?.get(clave)?.cantidad ?? 0;
      }
      return { mes, etiqueta: etiquetaMes(mes), porCategoria: porCat };
    }),
    tiempoPorMes: mesesPipeline.map((mes) => {
      const delMes = mesCategoria.get(mes);
      const porCat: Record<string, number | null> = {};
      for (const clave of CATEGORIAS_PIPELINE) {
        porCat[clave] = promedioHoras(delMes?.get(clave));
      }
      return { mes, etiqueta: etiquetaMes(mes), porCategoria: porCat };
    }),
    sinOcPorMes: [...sinOcMes.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((mes) => ({
        mes,
        etiqueta: etiquetaMes(mes),
        cantidad: sinOcMes.get(mes)?.cantidad ?? 0,
        tiempoPromedioHoras: promedioHoras(sinOcMes.get(mes)),
      })),
    entradasExactas,
    entradasTotales,
  };

  // ── Grupo 3: análisis histórico ───────────────────────────────────────────
  // Cada indicador tiene su PROPIA ventana; el filtro global de periodo no
  // aplica aquí. La query ya trajo la ventana más ancha de las cinco, así que
  // el recorte por indicador es puro, en memoria.
  const ventanaAhorro = resolverVentana(vAhorro, ahora);
  const ventanaMonto = resolverVentana(vMonto, ahora);
  const ventanaTop3 = resolverVentana(vTop3, ahora);
  const ventanaCosto = resolverVentana(vCosto, ahora);
  const ventanaVariacion = resolverVentana(vVariacion, ahora);

  const etiquetaProducto = (p: { codigo: string; nombre: string }) =>
    `${p.codigo} — ${p.nombre}`;

  const ahorroProd = new Map<string, { etiqueta: string; valor: number }>();
  const montoProv = new Map<string, { etiqueta: string; valor: number }>();
  const costoProd = new Map<
    string,
    { etiqueta: string; unidad: string; montoMXN: number; cantidad: number }
  >();
  const productosVistos = new Map<string, { id: string; codigo: string; nombre: string }>();
  // Montos por producto para resolver el prefiltro de #3 y #5.
  const montoProdTop3 = new Map<string, number>();
  const montoProdVariacion = new Map<string, number>();
  const montoProdAncho = new Map<string, number>();

  // ── Pasada 1: lo que no depende del producto elegido ──────────────────────
  for (const lic of historicoRaw) {
    const items = lic.items.filter((it) =>
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

    const tc = parseTiposCambio(lic.tiposCambio);
    const fecha = fechaDeCompra(lic);
    const itemPorId = new Map(items.map((it) => [it.id, it]));

    for (const it of items) {
      productosVistos.set(it.productoId, {
        id: it.productoId,
        codigo: it.producto.codigo,
        nombre: it.producto.nombre,
      });
    }

    // #1 — Ahorro por producto (misma definición del Grupo 1: primera ronda con
    // puja − mejor precio, desde OFERTAS).
    if (dentroDe(fecha, ventanaAhorro)) {
      const itemsAhorro: LicitacionItemParaAhorro[] = items.map((it) => ({
        id: it.id,
        cantidadSolicitada: it.cantidadSolicitada,
        precioObjetivo: it.precioObjetivo,
        moneda: it.moneda,
      }));
      const ofertasAhorro: OfertaParaAhorro[] = items.flatMap((it) =>
        it.ofertas.map((o) => ({
          licitacionItemId: it.id,
          proveedorId: o.proveedorId,
          ronda: o.ronda,
          precioUnitario: o.precioUnitario,
          noDisponible: o.noDisponible,
          noAplica: o.noAplica,
        }))
      );
      for (const a of calcularAnalisisPorItem(itemsAhorro, ofertasAhorro)) {
        if (a.ahorroTotal == null) continue;
        const it = itemPorId.get(a.licitacionItemId);
        if (!it) continue;
        const acc = ahorroProd.get(it.productoId) ?? {
          etiqueta: etiquetaProducto(it.producto),
          valor: 0,
        };
        acc.valor += convertirAMoneda(a.ahorroTotal, a.moneda, MONEDA_BASE, tc);
        ahorroProd.set(it.productoId, acc);
      }
    }

    // #2, #4 y los montos por producto salen de ASIGNACIONES: es la única
    // fuente que sabe a QUIÉN se le compró y CUÁNTO se compró de verdad.
    for (const asig of lic.asignaciones) {
      if (!asignacionCuenta(asig.estatusProveedor)) continue; // rechazada ≠ compra
      const it = itemPorId.get(asig.licitacionItemId);
      if (!it) continue; // el material no pasó el filtro de nivel 2

      // Fórmula canónica de monto (seleccionActions.ts). AsignacionMaterial.moneda
      // es confiable: se hereda del LicitacionItem al asignar.
      const montoMXN = convertirAMoneda(
        asig.precioUnitario * asig.cantidadAsignada,
        asig.moneda,
        MONEDA_BASE,
        tc
      );

      if (dentroDe(fecha, ventanaMonto)) {
        const acc = montoProv.get(asig.proveedorId) ?? {
          etiqueta: asig.proveedor.razonSocial,
          valor: 0,
        };
        acc.valor += montoMXN;
        montoProv.set(asig.proveedorId, acc);
      }

      if (dentroDe(fecha, ventanaCosto)) {
        const acc = costoProd.get(it.productoId) ?? {
          etiqueta: etiquetaProducto(it.producto),
          unidad: it.producto.unidadMedida,
          montoMXN: 0,
          cantidad: 0,
        };
        acumularPonderado(acc, { montoMXN, cantidad: asig.cantidadAsignada });
        costoProd.set(it.productoId, acc);
      }

      if (dentroDe(fecha, ventanaTop3)) {
        montoProdTop3.set(it.productoId, (montoProdTop3.get(it.productoId) ?? 0) + montoMXN);
      }
      if (dentroDe(fecha, ventanaVariacion)) {
        montoProdVariacion.set(
          it.productoId,
          (montoProdVariacion.get(it.productoId) ?? 0) + montoMXN
        );
      }
      montoProdAncho.set(it.productoId, (montoProdAncho.get(it.productoId) ?? 0) + montoMXN);
    }
  }

  // ── Resolución del producto de #3 y #5 ────────────────────────────────────
  // El filtro global de producto MANDA. Si no hay, se respeta lo que eligió el
  // usuario en el selector propio; si tampoco, se prefiltra con el producto de
  // mayor monto en la ventana del indicador, con fallback a la ventana más
  // ancha para no arrancar en blanco sin explicación.
  const productoBloqueado = Boolean(filtros.productoId);
  const productoTop3 =
    filtros.productoId ||
    filtros.prodTop3 ||
    productoTopPorMonto(montoProdTop3) ||
    productoTopPorMonto(montoProdAncho) ||
    "";
  const productoVariacion =
    filtros.productoId ||
    filtros.prodVariacion ||
    productoTopPorMonto(montoProdVariacion) ||
    productoTopPorMonto(montoProdAncho) ||
    "";

  // ── Pasada 2: los dos indicadores de un solo producto ─────────────────────
  const top3Acc = new Map<
    string,
    { nombre: string; montoMXN: number; cantidad: number }
  >();
  const variacionMes = new Map<string, { montoMXN: number; cantidad: number }>();

  for (const lic of historicoRaw) {
    const items = lic.items.filter((it) =>
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

    const tc = parseTiposCambio(lic.tiposCambio);
    const fecha = fechaDeCompra(lic);

    // #3 — Top 3 proveedores por precio OFERTADO del producto elegido. Va desde
    // ofertas y no desde asignaciones a propósito: el sentido del indicador es
    // comparar proveedores, así que debe incluir a los que cotizaron y NO
    // ganaron. De cada proveedor se toma su MEJOR precio por material (no el
    // promedio de sus rondas, que arrastraría sus pujas iniciales altas).
    if (productoTop3 && dentroDe(fecha, ventanaTop3)) {
      for (const it of items) {
        if (it.productoId !== productoTop3) continue;
        // Una entrada por proveedor con SU mejor precio. Se agrupa primero y se
        // pide el mínimo al helper: recorrer `it.ofertas` comparando a mano era
        // lo que dejaba entrar el 0 de un "no dispongo" y coronaba como más
        // barato a un proveedor que no había cotizado.
        const ofertasPorProveedor = new Map<string, typeof it.ofertas>();
        for (const oferta of it.ofertas) {
          const previas = ofertasPorProveedor.get(oferta.proveedorId);
          if (previas) previas.push(oferta);
          else ofertasPorProveedor.set(oferta.proveedorId, [oferta]);
        }

        const mejorPorProveedor = new Map<
          string,
          { nombre: string; precio: number }
        >();
        for (const [proveedorId, ofertasDelProveedor] of ofertasPorProveedor) {
          const mejor = mejorOfertaValida(ofertasDelProveedor);
          // Sin oferta válida el proveedor NO entra al ranking. Antes entraba
          // con precio 0 y se llevaba el primer puesto.
          if (!mejor) continue;
          mejorPorProveedor.set(proveedorId, {
            nombre: mejor.proveedor.razonSocial,
            precio: mejor.precioUnitario,
          });
        }
        for (const [proveedorId, mejor] of mejorPorProveedor) {
          // La moneda es la del ITEM. OfertaItem.moneda no se escribe nunca.
          const montoMXN = convertirAMoneda(
            mejor.precio * it.cantidadSolicitada,
            it.moneda,
            MONEDA_BASE,
            tc
          );
          const acc = top3Acc.get(proveedorId) ?? {
            nombre: mejor.nombre,
            montoMXN: 0,
            cantidad: 0,
          };
          acumularPonderado(acc, { montoMXN, cantidad: it.cantidadSolicitada });
          top3Acc.set(proveedorId, acc);
        }
      }
    }

    // #5 — Variación del costo real pagado del producto elegido.
    if (productoVariacion && dentroDe(fecha, ventanaVariacion)) {
      const itemPorId = new Map(items.map((it) => [it.id, it]));
      for (const asig of lic.asignaciones) {
        if (!asignacionCuenta(asig.estatusProveedor)) continue;
        const it = itemPorId.get(asig.licitacionItemId);
        if (!it || it.productoId !== productoVariacion) continue;

        const montoMXN = convertirAMoneda(
          asig.precioUnitario * asig.cantidadAsignada,
          asig.moneda,
          MONEDA_BASE,
          tc
        );
        const mes = claveMes(fecha);
        const acc = variacionMes.get(mes) ?? { montoMXN: 0, cantidad: 0 };
        acumularPonderado(acc, { montoMXN, cantidad: asig.cantidadAsignada });
        variacionMes.set(mes, acc);
      }
    }
  }

  const historico: TableroData["historico"] = {
    ahorroPorProducto: construirPareto(
      [...ahorroProd.entries()].map(([id, v]) => ({ id, ...v }))
    ),
    montoPorProveedor: construirPareto(
      [...montoProv.entries()].map(([id, v]) => ({ id, ...v }))
    ),
    top3Proveedores: [...top3Acc.entries()]
      .map(([proveedorId, acc]) => ({
        proveedorId,
        proveedorNombre: acc.nombre,
        precioPromedio: promedioPonderado([acc]) ?? 0,
        cantidad: acc.cantidad,
      }))
      .filter((p) => p.precioPromedio > 0)
      .sort((a, b) => a.precioPromedio - b.precioPromedio) // MEJOR precio = más bajo
      .slice(0, 3),
    costoUnitario: [...costoProd.entries()]
      .map(([productoId, acc]) => ({
        productoId,
        etiqueta: acc.etiqueta,
        unidad: acc.unidad,
        precioPromedio: promedioPonderado([acc]) ?? 0,
      }))
      .filter((p) => p.precioPromedio > 0)
      .sort((a, b) => b.precioPromedio - a.precioPromedio),
    // Eje completo de la ventana: un mes sin compras es un hueco, no un punto.
    variacionPrecio: mesesEntre(ventanaVariacion).map((mes) => {
      const acc = variacionMes.get(mes);
      return {
        mes,
        etiqueta: etiquetaMes(mes),
        precioPromedio: acc ? promedioPonderado([acc]) : null,
        cantidad: acc?.cantidad ?? 0,
      };
    }),
    productosOpciones: [...productosVistos.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-MX")
    ),
    productoTop3,
    productoVariacion,
    productoBloqueado,
    proveedorFiltrado: Boolean(filtros.proveedorId),
  };

  // ── Compose and render ────────────────────────────────────────────────────
  const data: TableroData = {
    kpis: {
      licitacionesTotales,
      licitacionesEjecutadas,
      valorPrimeraRonda,
      valorMejoresPrecios,
      ahorroTotal,
      adherenciaPrecios,
      onTimeDelivery,
    },
    pipeline,
    historico,
    ahorroMensual,
    tiempoEtapas,
    precioChart,
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
