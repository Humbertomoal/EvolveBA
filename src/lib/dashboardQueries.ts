// ─────────────────────────────────────────────────────────────────────────────
// Consultas del Dashboard de entrada (/comprador) — SERVER ONLY (importa Prisma).
//
// Los tipos que produce viven en dashboardTypes.ts, que es puro. Ver la nota de
// blindaje pg/util-types allí: nada de este módulo puede llegar a un
// componente "use client".
//
// ── Criterio de diseño ─────────────────────────────────────────────────────
// Esta es la PRIMERA pantalla tras el login, así que el presupuesto de tiempo
// es más estrecho que el del Tablero de Indicadores. De ahí dos decisiones:
//
//   · Los conteos salen de UN groupBy, no de cinco count(). Y se clasifican con
//     clasificarLicitacion() —la misma función del tablero— porque "Esperando
//     Decisión" no es un estado sino un flag sobre "En Proceso": contar por
//     `estado` a secas traslapa cubos.
//   · El ahorro es la única consulta cara (necesita items → ofertas). Se acota
//     a 6 meses y UNA SOLA PASADA alimenta a la vez el KPI acumulado y los 6
//     puntos de la gráfica. Por eso el KPI es exactamente la suma de las barras.
//
// Los bloques de "necesita atención" NO cargan ofertas: son findMany acotados
// con select mínimo.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "./prisma";
import { verificarYActualizarEstado } from "./licitacionesLogica";
import {
  ESTADO_OC_PENDIENTE,
  clasificarLicitacion,
  type CategoriaLicitacion,
} from "./tableroCategorias";
import { ESTADOS_EJECUTADAS } from "./tableroQueries";
import { ESTADO_ESPERANDO_VALIDACION } from "./seleccionTypes";
import { claveMes, etiquetaMes } from "./tableroFiltros";
import {
  calcularAnalisisPorItem,
  calcularResumenAhorro,
  type LicitacionItemParaAhorro,
  type OfertaParaAhorro,
} from "./licitacionesAhorro";
import {
  MONEDA_BASE,
  convertirAMoneda,
  faltanTiposCambio,
  parseTiposCambio,
} from "./conversionMoneda";
import { asignacionCuenta } from "./tableroHistorico";
import { esOfertaValida } from "./ofertaValida";
import {
  LIMITE_ITEMS_ATENCION,
  LIMITE_TOP_PROVEEDORES,
  MESES_VENTANA_AHORRO,
  formatAntiguedad,
  type BloqueAtencion,
  type ConteosLicitacion,
  type DashboardData,
  type ItemAtencion,
  type PuntoAhorroMes,
  type PuntoTopProveedor,
} from "./dashboardTypes";

const MS_DIA = 86_400_000;

/**
 * Horizonte del bloque "rondas por cerrar". Sin él, el bloque listaría TODAS
 * las licitaciones en puja y sería un duplicado de la tarjeta "En proceso" en
 * vez de una lista de pendientes.
 */
const HORIZONTE_RONDA_MS = 24 * 60 * 60 * 1000;

/** Estados internos que todavía pueden avanzar solos con el reloj. */
const ESTADOS_AVANZABLES = ["Programada", "En Proceso"];

export type AlcanceDashboard = {
  compradorId: string;
  puedeVerTodo: boolean;
};

/**
 * Filtro base compartido por TODAS las consultas del dashboard: nunca se
 * muestran licitaciones borradas, y quien no puede ver todo solo ve las suyas.
 * Escrito una vez para que los cubos de arriba y las listas de abajo no puedan
 * describir universos distintos.
 */
function whereAlcance(alcance: AlcanceDashboard) {
  return {
    eliminado: false,
    ...(alcance.puedeVerTodo ? {} : { compradorId: alcance.compradorId }),
  };
}

// ── Avance perezoso de estado ────────────────────────────────────────────────

/**
 * Empuja el reloj de las licitaciones que pueden avanzar solas.
 *
 * NO hay cron en el proyecto: `verificarYActualizarEstado` corre de forma
 * perezosa cuando alguien carga Lanzamiento, Licitaciones en Proceso o un
 * detalle (ver licitacionesLogica.ts). Como el dashboard pasa a ser la PRIMERA
 * pantalla tras el login, sin esto mostraría rondas ya vencidas como vivas y
 * licitaciones "Programada" que debieron arrancar hace horas.
 *
 * Es seguro llamarlo en concurrencia: cada escritura de ahí es un
 * compare-and-set (`updateMany` con el estado leído en el WHERE), así que dos
 * pestañas a la vez no duplican transiciones ni entradas de bitácora.
 *
 * Mismo patrón que licitaciones-proceso/page.tsx y licitaciones/lanzamiento/page.tsx.
 */
export async function avanzarEstadosPendientes(
  alcance: AlcanceDashboard
): Promise<void> {
  const pendientes = await prisma.licitacion.findMany({
    where: { ...whereAlcance(alcance), estado: { in: ESTADOS_AVANZABLES } },
    select: { id: true },
  });

  await Promise.all(pendientes.map(({ id }) => verificarYActualizarEstado(id)));
}

// ── Ventana mensual ──────────────────────────────────────────────────────────

/**
 * Las `n` claves de mes que terminan en el mes actual, p. ej.
 * ["2026-03", …, "2026-08"].
 *
 * OJO: se camina la aritmética año/mes a mano en vez de construir fechas con
 * `new Date(y, m, 1)`. `claveMes` bucketea en America/Mexico_City, mientras que
 * el servidor corre en UTC: una fecha construida como medianoche local (=UTC en
 * Vercel) se formatea como el día 30/31 del mes ANTERIOR en hora de México, y
 * el eje quedaría corrido un mes entero.
 */
function clavesUltimosMeses(ahora: Date, n: number): string[] {
  const [anio, mes] = claveMes(ahora).split("-").map(Number);
  const claves: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const indice = anio * 12 + (mes - 1) - i;
    const y = Math.floor(indice / 12);
    const m = (indice % 12) + 1;
    claves.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return claves;
}

/**
 * Corte para el `gte` de SQL. Se le resta un día de holgura a propósito: el
 * filtro de la base compara en UTC y el bucket mensual en hora de México, así
 * que una ventana exacta podría dejar fuera las primeras horas del mes más
 * viejo. Pasarse es inofensivo —lo que sobre se descarta al bucketear contra
 * las claves— pero quedarse corto perdería ahorro real.
 */
function corteSql(claveMasVieja: string): Date {
  const [anio, mes] = claveMasVieja.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, 1) - MS_DIA);
}

// ── Conteos por categoría ────────────────────────────────────────────────────

type FilaGroupBy = {
  estado: string;
  esperandoDecision: boolean;
  _count: { _all: number };
};

/**
 * Traduce el groupBy(estado, esperandoDecision) a los cubos VISIBLES.
 *
 * El groupBy incluye `esperandoDecision` en el `by` justamente porque
 * clasificarLicitacion lo necesita: sin esa columna, las licitaciones "En
 * Proceso" en espera de decisión se contarían como si siguieran pujando.
 */
function agruparConteos(filas: FilaGroupBy[]): ConteosLicitacion {
  const porCategoria = new Map<CategoriaLicitacion, number>();
  let sinClasificar = 0;
  // Las dos mitades de "en_cierre". Se separan aquí, sobre las filas crudas,
  // porque la categoría visible las funde y cada una es una acción distinta
  // (decidir vs asignar). Derivarlas después de agrupar sería imposible.
  let esperandoDecision = 0;
  let listasParaAsignar = 0;

  for (const fila of filas) {
    const categoria = clasificarLicitacion({
      estado: fila.estado,
      esperandoDecision: fila.esperandoDecision,
    });
    const cantidad = fila._count._all;
    if (!categoria) {
      sinClasificar += cantidad;
      continue;
    }
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + cantidad);

    if (categoria === "en_cierre") {
      if (fila.esperandoDecision) esperandoDecision += cantidad;
      else listasParaAsignar += cantidad;
    }
  }

  const de = (clave: CategoriaLicitacion) => porCategoria.get(clave) ?? 0;

  const borradores = de("en_construccion");
  const porLanzar = de("por_lanzar");
  const enProceso = de("en_licitacion");
  const enCierre = de("en_cierre");
  const cerradas = de("terminadas");
  const canceladas = de("cancelada");

  return {
    borradores,
    porLanzar,
    enProceso,
    enCierre,
    esperandoDecision,
    listasParaAsignar,
    cerradas,
    canceladas,
    activas: porLanzar + enProceso + enCierre,
    total: borradores + porLanzar + enProceso + enCierre + cerradas + canceladas,
    sinClasificar,
  };
}

// ── Consulta principal ───────────────────────────────────────────────────────

export async function getDashboardData(
  alcance: AlcanceDashboard,
  basePath: string
): Promise<DashboardData> {
  const ahora = new Date();
  const claves = clavesUltimosMeses(ahora, MESES_VENTANA_AHORRO);
  const desde = corteSql(claves[0]);
  const base = whereAlcance(alcance);

  const [
    filasEstado,
    proveedoresActivos,
    proveedoresTotal,
    materiales,
    licitacionesAhorro,
    esperandoDecision,
    listasParaAsignar,
    rondasEnCurso,
    ordenesPendientes,
    ordenesPendientesTotal,
  ] = await Promise.all([
    // 1 · Todos los cubos de licitaciones en un solo viaje.
    prisma.licitacion.groupBy({
      by: ["estado", "esperandoDecision"],
      where: base,
      _count: { _all: true },
    }),

    // 2-4 · Conteos planos de catálogo.
    prisma.proveedor.count({ where: { eliminado: false, estado: "Activo" } }),
    prisma.proveedor.count({ where: { eliminado: false } }),
    prisma.producto.count({ where: { eliminado: false } }),

    // 5 · La única consulta cara. Universo canónico de "ejecutadas"
    // (tableroQueries.ESTADOS_EJECUTADAS): la puja terminó y los precios ya no
    // se mueven. `noDisponible` es OBLIGATORIO en el select — sin él,
    // esOfertaValida deja pasar los "no dispongo" (guardados con precio 0) y el
    // ahorro se infla, que es el bug de la licitación 0009 (83.8 % vs 4.2 %).
    //
    // Alimenta TRES cosas de una sola pasada: el KPI de ahorro acumulado, la
    // gráfica mensual y el ranking de proveedores. `asignaciones` se sumó aquí
    // en vez de en una query aparte porque son ~113 filas contra las ~1,180 de
    // oferta que esta consulta ya trae: ~10 % más de payload y CERO viajes
    // nuevos. Un groupBy no serviría de alternativa — Prisma no puede sumar la
    // expresión `precioUnitario * cantidadAsignada` ni aplicar el tipo de
    // cambio, que es por licitación.
    prisma.licitacion.findMany({
      where: {
        ...base,
        estado: { in: ESTADOS_EJECUTADAS },
        OR: [
          { fechaCerrada: { gte: desde } },
          { fechaFinalizada: { gte: desde } },
          { fechaCreacion: { gte: desde } },
        ],
      },
      select: {
        numero: true,
        tiposCambio: true,
        fechaCreacion: true,
        fechaCerrada: true,
        fechaFinalizada: true,
        items: {
          select: {
            id: true,
            cantidadSolicitada: true,
            precioObjetivo: true,
            moneda: true,
            ofertas: {
              select: {
                proveedorId: true,
                ronda: true,
                precioUnitario: true,
                noDisponible: true,
                noAplica: true,
              },
            },
          },
        },
        // Ranking de proveedores. `moneda` aquí SÍ es confiable (se hereda del
        // LicitacionItem al asignar), a diferencia de OfertaItem.moneda, que no
        // se escribe nunca. `proveedor` va anidado —un join, no un N+1— porque
        // sin la razón social el ranking serían ids.
        asignaciones: {
          select: {
            proveedorId: true,
            cantidadAsignada: true,
            precioUnitario: true,
            moneda: true,
            estatusProveedor: true,
            proveedor: { select: { razonSocial: true } },
          },
        },
      },
    }),

    // 6 · Esperando decisión: el pseudo-estado (flag sobre "En Proceso").
    prisma.licitacion.findMany({
      where: { ...base, estado: "En Proceso", esperandoDecision: true },
      select: {
        id: true,
        numero: true,
        jerarquia: true,
        fechaEsperandoDecision: true,
        fechaCreacion: true,
      },
      orderBy: { fechaEsperandoDecision: "asc" },
      take: LIMITE_ITEMS_ATENCION,
    }),

    // 7 · Listas para asignar. Mismos estados que la pantalla de Selección
    // (seleccion-proveedores/page.tsx), para que el link no lleve a una lista
    // donde la licitación no aparece.
    prisma.licitacion.findMany({
      where: {
        ...base,
        estado: { in: ["Cerrada", ESTADO_ESPERANDO_VALIDACION] },
      },
      select: {
        id: true,
        numero: true,
        jerarquia: true,
        fechaCerrada: true,
        fechaCreacion: true,
      },
      orderBy: { fechaCerrada: "asc" },
      take: LIMITE_ITEMS_ATENCION,
    }),

    // 8 · Rondas vivas. El fin de ronda es calculado
    // (inicioRondaActual + duracionRondaMinutos), así que no se puede ordenar
    // ni acotar en SQL: se traen todas las que pujan —conjunto chico por
    // definición— y se recorta en memoria.
    prisma.licitacion.findMany({
      where: {
        ...base,
        estado: "En Proceso",
        esperandoDecision: false,
        inicioRondaActual: { not: null },
      },
      select: {
        id: true,
        numero: true,
        jerarquia: true,
        rondaActual: true,
        maxRondas: true,
        inicioRondaActual: true,
        duracionRondaMinutos: true,
      },
    }),

    // 9-10 · Órdenes creadas pero nunca puestas en tránsito. La orden entra si
    // SU licitación entra, igual que en el tablero.
    prisma.ordenCompra.findMany({
      where: { estado: ESTADO_OC_PENDIENTE, licitacion: base },
      select: {
        id: true,
        numero: true,
        fechaPendiente: true,
        fechaCreacion: true,
        proveedor: { select: { razonSocial: true } },
      },
      orderBy: { fechaCreacion: "asc" },
      take: LIMITE_ITEMS_ATENCION,
    }),
    prisma.ordenCompra.count({
      where: { estado: ESTADO_OC_PENDIENTE, licitacion: base },
    }),
  ]);

  // ── Una pasada para el KPI de ahorro, la gráfica y el ranking ─────────────
  const clavesVentana = new Set(claves);
  const ahorroPorMes = new Map<string, number>();
  const avisoTiposCambio: string[] = [];
  let ahorroTotal = 0;
  let lineaBaseTotal = 0;
  let licitacionesConAhorro = 0;

  // Acumuladores del ranking de proveedores, todos en MXN.
  const porProveedor = new Map<
    string,
    { nombre: string; montoMXN: number; ganadas: number }
  >();
  // proveedorId → licitaciones en las que ofertó. Sale gratis de las ofertas
  // que la consulta ya trae para el ahorro.
  const participaciones = new Map<string, number>();

  for (const lic of licitacionesAhorro) {
    if (lic.items.length === 0) continue;

    // El ahorro se materializa cuando el precio se congela, o sea al cerrar.
    // Misma regla que el Tablero de Indicadores.
    const fechaCorte = lic.fechaCerrada ?? lic.fechaFinalizada ?? lic.fechaCreacion;
    const mes = claveMes(fechaCorte);
    // El `gte` de SQL es más ancho que la ventana (ver corteSql) y el OR puede
    // colar una licitación cuyo corte real quedó fuera. Descartarla aquí es lo
    // que garantiza que el KPI acumulado sea EXACTAMENTE la suma de las barras.
    if (!clavesVentana.has(mes)) continue;

    const tiposCambio = parseTiposCambio(lic.tiposCambio);

    // ── Ranking de proveedores ──────────────────────────────────────────────
    // Va ANTES de los guards del ahorro (`sin ofertas`, `línea base ≤ 0`) a
    // propósito: son dos preguntas distintas. Una licitación adjudicada por
    // captura manual puede no tener con qué calcular ahorro y aun así ser una
    // compra real; colgar el ranking de esos guards la borraría del top sin
    // que nadie lo note.
    const ganadoresDeEstaLic = new Set<string>();
    for (const asig of lic.asignaciones) {
      // Una asignación rechazada por el proveedor no es una compra.
      if (!asignacionCuenta(asig.estatusProveedor)) continue;

      // CRÍTICO: convertir con el TC congelado de ESTA licitación. Sumar
      // importes en monedas mezcladas no solo escala mal el eje — reordena el
      // ranking, porque un proveedor que factura en USD aparecería ~18 veces
      // más chico de lo que es y caería puestos que no le tocan.
      const montoMXN = convertirAMoneda(
        asig.precioUnitario * asig.cantidadAsignada,
        asig.moneda,
        MONEDA_BASE,
        tiposCambio
      );

      const acc = porProveedor.get(asig.proveedorId) ?? {
        nombre: asig.proveedor.razonSocial,
        montoMXN: 0,
        ganadas: 0,
      };
      acc.montoMXN += montoMXN;
      porProveedor.set(asig.proveedorId, acc);
      ganadoresDeEstaLic.add(asig.proveedorId);
    }
    // Se cuenta UNA vez por licitación, no una por partida adjudicada.
    for (const proveedorId of ganadoresDeEstaLic) {
      porProveedor.get(proveedorId)!.ganadas++;
    }

    const participantes = new Set<string>();
    for (const it of lic.items) {
      for (const oferta of it.ofertas) {
        if (esOfertaValida(oferta)) participantes.add(oferta.proveedorId);
      }
    }
    for (const proveedorId of participantes) {
      participaciones.set(proveedorId, (participaciones.get(proveedorId) ?? 0) + 1);
    }

    // ── Ahorro ──────────────────────────────────────────────────────────────
    const itemsAhorro: LicitacionItemParaAhorro[] = lic.items.map((it) => ({
      id: it.id,
      cantidadSolicitada: it.cantidadSolicitada,
      precioObjetivo: it.precioObjetivo,
      moneda: it.moneda,
    }));
    const ofertasAhorro: OfertaParaAhorro[] = lic.items.flatMap((it) =>
      it.ofertas.map((o) => ({
        licitacionItemId: it.id,
        proveedorId: o.proveedorId,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
        noDisponible: o.noDisponible,
        noAplica: o.noAplica,
      }))
    );
    if (ofertasAhorro.length === 0) continue;

    if (
      faltanTiposCambio(
        lic.items.map((it) => it.moneda),
        tiposCambio,
        MONEDA_BASE
      )
    ) {
      avisoTiposCambio.push(lic.numero);
    }

    const analisis = calcularAnalisisPorItem(itemsAhorro, ofertasAhorro);
    const resumen = calcularResumenAhorro(analisis, true, tiposCambio, MONEDA_BASE);

    // Sin línea base no hay contra qué medir: la licitación no aporta en vez de
    // aportar un ahorro negativo igual al total gastado.
    if (resumen.lineaBasePromedioTotal <= 0) continue;

    licitacionesConAhorro++;
    lineaBaseTotal += resumen.lineaBasePromedioTotal;
    ahorroTotal += resumen.ahorroPromedioTotal;
    ahorroPorMes.set(
      mes,
      (ahorroPorMes.get(mes) ?? 0) + resumen.ahorroPromedioTotal
    );
  }

  // Eje completo: un mes sin licitaciones cerradas es una barra en cero, no un
  // hueco que corra las demás.
  const ahorroMensual: PuntoAhorroMes[] = claves.map((mes) => ({
    mes,
    etiqueta: etiquetaMes(mes),
    ahorro: ahorroPorMes.get(mes) ?? 0,
  }));

  // El total se calcula sobre TODOS los proveedores, no sobre los del top: es
  // el denominador con el que la tarjeta dice qué porcentaje del gasto
  // concentran los que se ven.
  const totalAdjudicadoMXN = [...porProveedor.values()].reduce(
    (suma, p) => suma + p.montoMXN,
    0
  );
  const topProveedores: PuntoTopProveedor[] = [...porProveedor.entries()]
    .map(([proveedorId, p]) => ({
      proveedorId,
      nombre: p.nombre,
      montoMXN: p.montoMXN,
      licitacionesGanadas: p.ganadas,
      licitacionesParticipadas: participaciones.get(proveedorId) ?? 0,
    }))
    .filter((p) => p.montoMXN > 0)
    .sort((a, b) => b.montoMXN - a.montoMXN)
    .slice(0, LIMITE_TOP_PROVEEDORES);

  // ── Bloques de atención ───────────────────────────────────────────────────
  const conteos = agruparConteos(filasEstado as FilaGroupBy[]);
  const ahoraMs = ahora.getTime();
  const rutaProceso = `${basePath}/comprador/licitaciones-proceso`;
  const rutaSeleccion = `${basePath}/comprador/seleccion-proveedores`;
  const rutaOrdenes = `${basePath}/comprador/ordenes`;

  const itemsDecision: ItemAtencion[] = esperandoDecision.map((lic) => {
    const desdeCuando = lic.fechaEsperandoDecision ?? lic.fechaCreacion;
    const espera = ahoraMs - desdeCuando.getTime();
    return {
      id: lic.id,
      titulo: lic.numero,
      subtitulo: lic.jerarquia,
      detalle: `Lleva ${formatAntiguedad(espera)} esperando`,
      href: `${rutaProceso}/${lic.id}`,
      fechaLimite: null,
      urgente: espera >= 2 * MS_DIA,
    };
  });

  const itemsAsignar: ItemAtencion[] = listasParaAsignar.map((lic) => {
    const desdeCuando = lic.fechaCerrada ?? lic.fechaCreacion;
    const espera = ahoraMs - desdeCuando.getTime();
    return {
      id: lic.id,
      titulo: lic.numero,
      subtitulo: lic.jerarquia,
      detalle: `Cerrada hace ${formatAntiguedad(espera)}`,
      href: `${rutaSeleccion}/${lic.id}`,
      fechaLimite: null,
      urgente: espera >= 3 * MS_DIA,
    };
  });

  // Solo las que cierran dentro del horizonte (o ya vencieron y el avance
  // perezoso no alcanzó a moverlas). Sin ese recorte, este bloque repetiría la
  // tarjeta "En proceso" en vez de listar pendientes.
  const rondasProximas = rondasEnCurso
    .map((lic) => ({
      lic,
      fin:
        lic.inicioRondaActual!.getTime() + lic.duracionRondaMinutos * 60_000,
    }))
    .filter(({ fin }) => fin - ahoraMs <= HORIZONTE_RONDA_MS)
    .sort((a, b) => a.fin - b.fin);

  const itemsRondas: ItemAtencion[] = rondasProximas
    .slice(0, LIMITE_ITEMS_ATENCION)
    .map(({ lic, fin }) => ({
      id: lic.id,
      titulo: lic.numero,
      subtitulo: `Ronda ${lic.rondaActual} de ${lic.maxRondas}`,
      detalle: fin <= ahoraMs ? "Ronda vencida" : "Cierra en",
      href: `${rutaProceso}/${lic.id}`,
      fechaLimite: new Date(fin).toISOString(),
      urgente: fin - ahoraMs <= 60 * 60 * 1000,
    }));

  const itemsOrdenes: ItemAtencion[] = ordenesPendientes.map((oc) => {
    const desdeCuando = oc.fechaPendiente ?? oc.fechaCreacion;
    const espera = ahoraMs - desdeCuando.getTime();
    return {
      id: oc.id,
      titulo: oc.numero,
      subtitulo: oc.proveedor.razonSocial,
      detalle: `Sin enviar hace ${formatAntiguedad(espera)}`,
      href: `${rutaOrdenes}/${oc.id}`,
      fechaLimite: null,
      urgente: espera >= 2 * MS_DIA,
    };
  });

  const atencion: BloqueAtencion[] = [
    {
      clave: "decision",
      titulo: "Esperando tu decisión",
      vacio: "Ninguna licitación espera decisión.",
      icono: "decision",
      tono: "ambar",
      // Sale del groupBy, no de otra query: es exactamente la fila
      // ("En Proceso", esperandoDecision = true).
      total: conteos.esperandoDecision,
      items: itemsDecision,
      hrefTodos: rutaProceso,
    },
    {
      clave: "asignar",
      titulo: "Listas para asignar",
      vacio: "No hay licitaciones pendientes de asignación.",
      icono: "asignar",
      tono: "azul",
      total: conteos.listasParaAsignar,
      items: itemsAsignar,
      hrefTodos: rutaSeleccion,
    },
    {
      clave: "ronda",
      titulo: "Rondas por cerrar",
      vacio: "Ninguna ronda cierra en las próximas 24 h.",
      icono: "ronda",
      tono: "rojo",
      total: rondasProximas.length,
      items: itemsRondas,
      hrefTodos: rutaProceso,
    },
    {
      clave: "orden",
      titulo: "Órdenes sin enviar",
      vacio: "Todas las órdenes salieron.",
      icono: "orden",
      tono: "neutral",
      total: ordenesPendientesTotal,
      items: itemsOrdenes,
      hrefTodos: rutaOrdenes,
    },
  ];

  return {
    metricas: {
      licitaciones: conteos,
      proveedoresActivos,
      proveedoresTotal,
      materiales,
      ahorroTotal,
      ahorroPct:
        lineaBaseTotal > 0 ? (ahorroTotal / lineaBaseTotal) * 100 : null,
      licitacionesConAhorro,
    },
    ahorroMensual,
    topProveedores,
    totalAdjudicadoMXN,
    atencion,
    // Sin duplicados: una licitación con tres monedas sin tasa se avisa una vez.
    avisoTiposCambio: [...new Set(avisoTiposCambio)],
  };
}
