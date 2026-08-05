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
  sesion: SesionTablero
): Prisma.LicitacionWhereInput {
  const { startDate, endDate } = resolverRangoFechas(filtros);
  const rango = { gte: startDate, lte: endDate };

  return {
    eliminado: false,
    ...(sesion.puedeVerTodo ? {} : { compradorId: sesion.compradorId }),
    // Regla 2: entra si CUALQUIERA de las tres fechas cae en el rango. Una
    // licitación creada en enero y cerrada en marzo cuenta al filtrar marzo.
    OR: [
      { fechaCreacion: rango },
      { fechaCerrada: rango },
      { fechaFinalizada: rango },
    ],
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
