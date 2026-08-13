// ─────────────────────────────────────────────────────────────────────────────
// Consultas del Tablero del Proveedor — SERVER ONLY (importa Prisma).
//
// ── AISLAMIENTO ────────────────────────────────────────────────────────────
// El `proveedorId` de todas estas funciones DEBE venir de
// getProveedorSessionSegura(), nunca de la URL ni de la cookie. Para que no se
// pueda pasar por accidente, las firmas lo reciben como un tipo nominal
// (`ProveedorAutenticado`) que solo se puede construir desde ese helper.
//
// El `where` scopea SIEMPRE por participación del proveedor:
//   ofertas del proveedor  OR  asignaciones del proveedor  OR  invitaciones
// Una licitación en la que no participó nunca entra al resultado. Y el filtrado
// fino (qué ofertas/asignaciones se leen dentro de cada licitación) vuelve a
// filtrar por proveedorId: traer la licitación no implica ver a la competencia,
// salvo el precio ganador agregado que exige el indicador de sobrecosto.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from ".prisma/client/default";
import { prisma } from "./prisma";
import { resolverRangoFechas, SIN_FAMILIA, type FiltrosTablero } from "./tableroFiltros";
import { ESTADOS_EJECUTADAS } from "./tableroQueries";

/**
 * Marca nominal: un proveedorId que pasó por getProveedorSessionSegura().
 * Un string suelto no es asignable a este tipo, así que no se puede colar el
 * valor de un searchParam sin que TypeScript lo señale.
 */
export type ProveedorAutenticado = string & { readonly __proveedorAutenticado: unique symbol };

export function marcarProveedorAutenticado(id: string): ProveedorAutenticado {
  return id as ProveedorAutenticado;
}

function whereItems(filtros: FiltrosTablero): Prisma.LicitacionItemWhereInput {
  const producto: Prisma.ProductoWhereInput = { eliminado: false };
  if (filtros.familia === SIN_FAMILIA) {
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
 * `where` de licitaciones del proveedor. A diferencia del comprador, NO scopea
 * por compradorId sino por participación del proveedor autenticado.
 */
export function construirWhereLicitacionProveedor(
  filtros: FiltrosTablero,
  proveedorId: ProveedorAutenticado
): Prisma.LicitacionWhereInput {
  const { startDate, endDate } = resolverRangoFechas(filtros);
  const rango = { gte: startDate, lte: endDate };

  return {
    eliminado: false,
    estado: { in: ESTADOS_EJECUTADAS },
    // Periodo: misma regla OR del tablero del comprador.
    AND: [
      {
        OR: [
          { fechaCreacion: rango },
          { fechaCerrada: rango },
          { fechaFinalizada: rango },
        ],
      },
      {
        // AISLAMIENTO: solo licitaciones donde ESTE proveedor participó.
        OR: [
          { proveedoresInvitados: { some: { proveedorId } } },
          { asignaciones: { some: { proveedorId } } },
          { items: { some: { ofertas: { some: { proveedorId } } } } },
        ],
      },
    ],
    ...(filtros.jerarquia ? { jerarquia: filtros.jerarquia } : {}),
    items: { some: whereItems(filtros) },
  };
}

/**
 * Select del tablero del proveedor.
 *
 * `items.ofertas` trae SOLO las ofertas del proveedor autenticado (los precios
 * de la competencia no salen de la base). La única excepción deliberada son las
 * `asignaciones`, que se leen completas porque el indicador de sobrecosto
 * necesita el precio ganador del material — pero de ahí solo se deriva un
 * agregado (cuánto más caro ofertó), nunca se expone quién ganó ni a qué precio.
 */
export function licitacionProveedorSelect(proveedorId: ProveedorAutenticado) {
  return {
    id: true,
    numero: true,
    estado: true,
    tiposCambio: true,
    fechaCreacion: true,
    fechaCerrada: true,
    fechaFinalizada: true,
    proveedoresInvitados: {
      where: { proveedorId },
      select: { proveedorId: true },
    },
    items: {
      select: {
        id: true,
        productoId: true,
        moneda: true,
        cantidadSolicitada: true,
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
        // Solo SUS ofertas.
        ofertas: {
          where: { proveedorId },
          select: { precioUnitario: true, ronda: true, proveedorId: true, noDisponible: true, noAplica: true },
        },
      },
    },
    // Todas las asignaciones del material: hacen falta para saber el precio
    // ganador (indicadores 11 y 12). Ver nota de arriba.
    asignaciones: {
      select: {
        licitacionItemId: true,
        proveedorId: true,
        cantidadAsignada: true,
        precioUnitario: true,
        moneda: true,
        estatusProveedor: true,
      },
    },
  } satisfies Prisma.LicitacionSelect;
}

export type LicitacionProveedorTablero = Prisma.LicitacionGetPayload<{
  select: ReturnType<typeof licitacionProveedorSelect>;
}>;

export async function getLicitacionesProveedor(
  filtros: FiltrosTablero,
  proveedorId: ProveedorAutenticado
): Promise<LicitacionProveedorTablero[]> {
  return prisma.licitacion.findMany({
    where: construirWhereLicitacionProveedor(filtros, proveedorId),
    select: licitacionProveedorSelect(proveedorId),
    orderBy: { numero: "asc" },
  });
}

/** Familias y productos con movimiento del proveedor, para los desplegables. */
export async function getOpcionesProveedor(
  filtros: FiltrosTablero,
  proveedorId: ProveedorAutenticado
): Promise<{
  familias: string[];
  productos: { id: string; codigo: string; nombre: string; familia: string | null }[];
  hayProductosSinFamilia: boolean;
}> {
  const base = construirWhereLicitacionProveedor(
    { ...filtros, familia: "", productoId: "" },
    proveedorId
  );

  const items = await prisma.licitacionItem.findMany({
    where: { licitacion: base, producto: { eliminado: false } },
    select: {
      productoId: true,
      producto: { select: { id: true, codigo: true, nombre: true, familia: true } },
    },
    distinct: ["productoId"],
  });

  const productos = items
    .map((it) => ({
      id: it.producto.id,
      codigo: it.producto.codigo,
      nombre: it.producto.nombre,
      familia: it.producto.familia?.trim() ? it.producto.familia.trim() : null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX"));

  const familias = [
    ...new Set(productos.map((p) => p.familia).filter((f): f is string => f !== null)),
  ].sort((a, b) => a.localeCompare(b, "es-MX"));

  return {
    familias,
    productos,
    hayProductosSinFamilia: productos.some((p) => p.familia === null),
  };
}
