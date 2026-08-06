// ─────────────────────────────────────────────────────────────────────────────
// Consultas del Tablero de Indicadores — SERVER ONLY (importa Prisma).
//
// Aquí vive el nivel 1 del filtrado (el `where` de Prisma). El nivel 2 (filtro
// por material, en memoria) vive en tableroFiltros.ts, que es puro y sí se
// puede importar desde el cliente. Ver la nota larga en ese archivo: los dos
// niveles son obligatorios o los KPIs mienten.
//
// Todo indicador del tablero —presente y futuro— debe obtener sus datos desde
// aquí en vez de escribir su propio `where`. Esa es la razón de existir del
// módulo: cuando el where se duplica, se duplica desalineado (que es justo
// como las órdenes de licitaciones borradas se colaban al KPI de on-time
// mientras quedaban fuera del de ahorro).
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from ".prisma/client/default";
import { prisma } from "./prisma";
import { ESTADO_ESPERANDO_VALIDACION } from "./seleccionTypes";
import type { TransicionLog } from "./tableroEtapas";
import {
  SIN_FAMILIA,
  resolverRangoFechas,
  type FiltrosTablero,
  type OpcionProducto,
  type OpcionProveedor,
} from "./tableroFiltros";

// Se re-exportan por comodidad de los call sites server; la definición canónica
// vive en tableroFiltros.ts para que el cliente no tenga que pasar por aquí.
export type { OpcionProducto, OpcionProveedor };

export type SesionTablero = {
  compradorId: string;
  puedeVerTodo: boolean;
};

// ── Nivel 1: construcción de los `where` ─────────────────────────────────────

/**
 * Condición sobre los materiales de la licitación. Se usa dentro de
 * `items: { some: … }` para descartar de raíz las licitaciones sin ningún
 * material que califique, y se refleja en itemPasaFiltro() para el nivel 2.
 */
function whereItems(filtros: FiltrosTablero): Prisma.LicitacionItemWhereInput {
  const producto: Prisma.ProductoWhereInput = { eliminado: false };

  if (filtros.familia === SIN_FAMILIA) {
    // Producto.familia es nullable y en la práctica también hay cadenas vacías.
    producto.OR = [{ familia: null }, { familia: "" }];
  } else if (filtros.familia) {
    producto.familia = filtros.familia;
  }

  return {
    ...(filtros.productoId ? { productoId: filtros.productoId } : {}),
    producto,
  };
}

/**
 * `where` canónico de licitaciones del tablero. Aplica las 4 reglas globales:
 *   · eliminado=false siempre
 *   · periodo con lógica OR (creación | cierre | finalización)
 *   · alcance por comprador salvo que pueda ver todo
 *   · filtros de criticidad, proveedor, familia y producto
 */
export function construirWhereLicitacion(
  filtros: FiltrosTablero,
  sesion: SesionTablero,
  opciones?: { ignorarPeriodo?: boolean }
): Prisma.LicitacionWhereInput {
  const { startDate, endDate } = resolverRangoFechas(filtros);
  const rango = { gte: startDate, lte: endDate };

  return {
    eliminado: false,
    ...(sesion.puedeVerTodo ? {} : { compradorId: sesion.compradorId }),
    // Regla 2: entra si CUALQUIERA de las tres fechas cae en el rango. Una
    // licitación creada en enero y cerrada en marzo cuenta al filtrar marzo.
    //
    // ignorarPeriodo lo usa el pipeline del Grupo 2, que es una foto del estado
    // ACTUAL: filtrar por periodo ahí escondería las licitaciones más atoradas
    // (un borrador de hace 6 meses no tiene cierre ni finalización, así que
    // ninguna de las tres fechas caería en la ventana) — justo las que el
    // indicador existe para encontrar.
    ...(opciones?.ignorarPeriodo
      ? {}
      : {
          OR: [
            { fechaCreacion: rango },
            { fechaCerrada: rango },
            { fechaFinalizada: rango },
          ],
        }),
    ...(filtros.jerarquia ? { jerarquia: filtros.jerarquia } : {}),
    ...(filtros.proveedorId
      ? { proveedoresInvitados: { some: { proveedorId: filtros.proveedorId } } }
      : {}),
    items: { some: whereItems(filtros) },
  };
}

/**
 * `where` de órdenes de compra. La orden entra si SU LICITACIÓN entra — no por
 * su propia fechaCreacion. Así el KPI de on-time y el de ahorro describen el
 * mismo universo; antes divergían y las órdenes de licitaciones borradas
 * entraban a on-time pero no a ahorro.
 */
export function construirWhereOrden(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Prisma.OrdenCompraWhereInput {
  return {
    licitacion: construirWhereLicitacion(filtros, sesion),
    ...(filtros.proveedorId ? { proveedorId: filtros.proveedorId } : {}),
  };
}

// ── Formas de los datos que consume el tablero ───────────────────────────────

export const LICITACION_TABLERO_INCLUDE = {
  items: {
    include: {
      producto: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          familia: true,
          eliminado: true,
        },
      },
      ofertas: { select: { precioUnitario: true, ronda: true } },
    },
  },
} satisfies Prisma.LicitacionInclude;

export type LicitacionTablero = Prisma.LicitacionGetPayload<{
  include: typeof LICITACION_TABLERO_INCLUDE;
}>;

export type LicitacionItemTablero = LicitacionTablero["items"][number];

export const ORDEN_TABLERO_SELECT = {
  id: true,
  estado: true,
  fechaEstimadaEntrega: true,
  fechaEntregada: true,
  fechaRecibida: true,
  proveedor: { select: { id: true, razonSocial: true } },
} satisfies Prisma.OrdenCompraSelect;

export type OrdenTablero = Prisma.OrdenCompraGetPayload<{
  select: typeof ORDEN_TABLERO_SELECT;
}>;

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getLicitacionesTablero(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Promise<LicitacionTablero[]> {
  return prisma.licitacion.findMany({
    where: construirWhereLicitacion(filtros, sesion),
    include: LICITACION_TABLERO_INCLUDE,
    orderBy: { numero: "asc" },
  });
}

export async function getOrdenesTablero(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Promise<OrdenTablero[]> {
  return prisma.ordenCompra.findMany({
    where: construirWhereOrden(filtros, sesion),
    select: ORDEN_TABLERO_SELECT,
  });
}

// ── Universo de licitaciones "ejecutadas" ────────────────────────────────────
//
// La puja terminó y los precios ya no se mueven. Quedan fuera Borrador,
// Programada, En Proceso y Esperando Decisión (precios aún vivos) y Cancelada
// (no hubo ejecución, y su ciclo interrumpido distorsionaría los promedios de
// tiempo por etapa).
export const ESTADOS_EJECUTADAS: string[] = [
  "Cerrada",
  ESTADO_ESPERANDO_VALIDACION,
  "Finalizada",
];

export function esLicitacionEjecutada(estado: string): boolean {
  return ESTADOS_EJECUTADAS.includes(estado);
}

export type EtapasTablero = {
  logsPorLicitacion: TransicionLog[][];
  /** Licitaciones del universo, tengan o no bitácora utilizable. */
  licitacionesTotales: number;
};

/**
 * Bitácoras de estado de las licitaciones ejecutadas.
 *
 * Va en query APARTE y no en LICITACION_TABLERO_INCLUDE a propósito: cargar
 * estadoLogs para todas las licitaciones infla el payload cuando solo las
 * ejecutadas los necesitan (el resto ni siquiera se grafica).
 */
export async function getEtapasTablero(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Promise<EtapasTablero> {
  const rows = await prisma.licitacion.findMany({
    where: {
      ...construirWhereLicitacion(filtros, sesion),
      estado: { in: ESTADOS_EJECUTADAS },
    },
    select: {
      id: true,
      estadoLogs: {
        select: { estadoAnterior: true, estadoNuevo: true, at: true },
        orderBy: { at: "asc" },
      },
    },
  });

  return {
    logsPorLicitacion: rows.map((r) => r.estadoLogs),
    licitacionesTotales: rows.length,
  };
}

// ── Pipeline (Grupo 2): foto del estado actual ───────────────────────────────
//
// Select propio y NO el include principal: el pipeline necesita cosas que los
// demás indicadores no (el último estadoLog, las órdenes con su estado) y no
// necesita nada de lo que sí cargan ellos (items, ofertas). Meterlo todo en un
// solo include cargaría de más en ambas direcciones.
//
// Tampoco necesita el filtrado de nivel 2: aquí se CUENTAN licitaciones, no se
// suman importes por material, y el `items: { some: … }` del where ya garantiza
// que solo entren las que tienen material que califica.
export const LICITACION_PIPELINE_SELECT = {
  id: true,
  numero: true,
  estado: true,
  esperandoDecision: true,
  fechaCreacion: true,
  fechaInicioLicitacion: true,
  fechaEsperandoDecision: true,
  fechaCerrada: true,
  fechaFinalizada: true,
  fechaCancelada: true,
  // Último registro = cuándo entró al estado en el que está hoy.
  estadoLogs: {
    select: { estadoNuevo: true, at: true },
    orderBy: { at: "desc" },
    take: 1,
  },
  // Para "Cerradas sin OC enviada": OC creada y aún sin poner en tránsito.
  ordenes: {
    select: { estado: true, fechaPendiente: true, fechaCreacion: true },
  },
} satisfies Prisma.LicitacionSelect;

export type LicitacionPipeline = Prisma.LicitacionGetPayload<{
  select: typeof LICITACION_PIPELINE_SELECT;
}>;

export async function getLicitacionesPipeline(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Promise<LicitacionPipeline[]> {
  return prisma.licitacion.findMany({
    where: construirWhereLicitacion(filtros, sesion, { ignorarPeriodo: true }),
    select: LICITACION_PIPELINE_SELECT,
  });
}

// ── Histórico (Grupo 3) ──────────────────────────────────────────────────────
//
// Select propio porque los indicadores históricos necesitan cosas que el
// include principal no trae: `proveedorId` en las ofertas (para el top-3 de
// proveedores, que debe incluir a quienes cotizaron y NO ganaron) y las
// asignaciones completas (para los montos realmente comprados).
//
// OJO con la moneda: la de las ofertas se toma de LicitacionItem.moneda, nunca
// de OfertaItem.moneda (que no se escribe nunca y siempre vale su default).
// AsignacionMaterial.moneda SÍ es confiable: se hereda del item al asignar.
export const LICITACION_HISTORICO_SELECT = {
  id: true,
  numero: true,
  estado: true,
  tiposCambio: true,
  fechaCreacion: true,
  fechaCerrada: true,
  fechaFinalizada: true,
  items: {
    select: {
      id: true,
      productoId: true,
      moneda: true,
      cantidadSolicitada: true,
      precioObjetivo: true,
      producto: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          familia: true,
          unidadMedida: true,
          eliminado: true,
        },
      },
      ofertas: {
        select: {
          precioUnitario: true,
          ronda: true,
          proveedorId: true,
          proveedor: { select: { razonSocial: true } },
        },
      },
    },
  },
  asignaciones: {
    select: {
      licitacionItemId: true,
      proveedorId: true,
      cantidadAsignada: true,
      precioUnitario: true,
      moneda: true,
      estatusProveedor: true,
      proveedor: { select: { razonSocial: true } },
    },
  },
} satisfies Prisma.LicitacionSelect;

export type LicitacionHistorico = Prisma.LicitacionGetPayload<{
  select: typeof LICITACION_HISTORICO_SELECT;
}>;

export type LicitacionHistoricoItem = LicitacionHistorico["items"][number];

/**
 * Licitaciones ejecutadas desde `desde`. El filtro global de periodo NO aplica
 * (cada indicador del Grupo 3 tiene el suyo); `desde` es la ventana más ancha
 * entre las cinco seleccionadas, y el recorte fino se hace en memoria.
 */
export async function getLicitacionesHistorico(
  filtros: FiltrosTablero,
  sesion: SesionTablero,
  desde: Date
): Promise<LicitacionHistorico[]> {
  return prisma.licitacion.findMany({
    where: {
      ...construirWhereLicitacion(filtros, sesion, { ignorarPeriodo: true }),
      estado: { in: ESTADOS_EJECUTADAS },
      OR: [
        { fechaCerrada: { gte: desde } },
        { fechaFinalizada: { gte: desde } },
        { fechaCreacion: { gte: desde } },
      ],
    },
    select: LICITACION_HISTORICO_SELECT,
  });
}

// ── Opciones de los desplegables ─────────────────────────────────────────────

export type OpcionesFiltros = {
  proveedores: OpcionProveedor[];
  jerarquias: string[];
  familias: string[];
  productos: OpcionProducto[];
  /** true si hay productos sin familia → se ofrece la opción "Sin familia". */
  hayProductosSinFamilia: boolean;
};

export async function getOpcionesFiltros(
  filtros: FiltrosTablero,
  sesion: SesionTablero
): Promise<OpcionesFiltros> {
  // Las facetas se calculan SIN el filtro que ellas mismas alimentan: si la
  // lista de familias se acotara a la familia ya elegida, quedaría con una sola
  // opción y no habría forma de cambiarla.
  const sinFacetasProducto: FiltrosTablero = {
    ...filtros,
    familia: "",
    productoId: "",
  };
  const whereParaProductos = construirWhereLicitacion(sinFacetasProducto, sesion);
  const whereParaJerarquias = construirWhereLicitacion(
    { ...sinFacetasProducto, jerarquia: "" },
    sesion
  );

  const [proveedoresRaw, jerarquiasRaw, itemsRaw] = await Promise.all([
    // Regla 3: se conservan los proveedores dados de baja (estado ≠ "Activo")
    // que tengan participación histórica — ocultarlos escondía datos reales que
    // igual siguen sumando en los indicadores. `eliminado: true` sí sale
    // siempre (regla 1): dado de baja y borrado no son lo mismo.
    prisma.proveedor.findMany({
      where: {
        eliminado: false,
        OR: [
          { estado: "Activo" },
          { licitaciones: { some: { licitacion: { eliminado: false } } } },
          { ofertas: { some: {} } },
          { asignaciones: { some: {} } },
          { ordenes: { some: {} } },
        ],
      },
      select: { id: true, razonSocial: true, estado: true },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.licitacion.findMany({
      where: { ...whereParaJerarquias, jerarquia: { not: null } },
      select: { jerarquia: true },
      distinct: ["jerarquia"],
    }),
    prisma.licitacionItem.findMany({
      where: {
        licitacion: whereParaProductos,
        producto: { eliminado: false },
      },
      select: {
        productoId: true,
        producto: {
          select: { id: true, codigo: true, nombre: true, familia: true },
        },
      },
      distinct: ["productoId"],
    }),
  ]);

  const productos: OpcionProducto[] = itemsRaw
    .map((it) => ({
      id: it.producto.id,
      codigo: it.producto.codigo,
      nombre: it.producto.nombre,
      familia: it.producto.familia?.trim() ? it.producto.familia.trim() : null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX"));

  const familias = [
    ...new Set(
      productos.map((p) => p.familia).filter((f): f is string => f !== null)
    ),
  ].sort((a, b) => a.localeCompare(b, "es-MX"));

  return {
    proveedores: proveedoresRaw.map((p) => ({
      id: p.id,
      nombre: p.razonSocial,
      inactivo: p.estado !== "Activo",
    })),
    jerarquias: jerarquiasRaw
      .map((l) => l.jerarquia)
      .filter((j): j is string => Boolean(j))
      .sort((a, b) => a.localeCompare(b, "es-MX")),
    familias,
    productos,
    hayProductosSinFamilia: productos.some((p) => p.familia === null),
  };
}
