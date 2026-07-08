import { prisma } from "@/src/lib/prisma";
import type { Producto, ProductoInput } from "@/src/data/productos";

type ProductoDB = {
  id: string;
  codigo: string;
  nombre: string;
  tipoItem: string;
  familia: string | null;
  unidadMedida: string;
  descripcion: string | null;
  imagenUrl: string | null;
  especificacionesTecnicas: string | null;
  archivosEspecificaciones: string | null;
  monedaPredeterminada: string | null;
  createdAt: Date;
};

const PRODUCTO_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  tipoItem: true,
  familia: true,
  unidadMedida: true,
  descripcion: true,
  imagenUrl: true,
  especificacionesTecnicas: true,
  archivosEspecificaciones: true,
  monedaPredeterminada: true,
  createdAt: true,
} as const;

function mapear(p: ProductoDB): Producto {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    tipoItem: p.tipoItem as Producto["tipoItem"],
    familia: p.familia ?? undefined,
    unidadMedida: p.unidadMedida,
    descripcion: p.descripcion ?? undefined,
    imagenUrl: p.imagenUrl ?? undefined,
    especificacionesTecnicas: p.especificacionesTecnicas ?? undefined,
    archivosEspecificaciones: p.archivosEspecificaciones ?? undefined,
    monedaPredeterminada: p.monedaPredeterminada ?? "MXN",
    createdAt: p.createdAt,
  };
}

export async function getProductos(): Promise<Producto[]> {
  const rows = await prisma.producto.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: "asc" },
    select: PRODUCTO_SELECT,
  });
  return rows.map(mapear);
}

export async function getProductoById(id: string): Promise<Producto | null> {
  const row = await prisma.producto.findUnique({ where: { id }, select: PRODUCTO_SELECT });
  return row ? mapear(row) : null;
}

export async function crearProducto(datos: ProductoInput): Promise<Producto> {
  const row = await prisma.producto.create({
    data: {
      codigo: datos.codigo,
      nombre: datos.nombre,
      tipoItem: datos.tipoItem,
      familia: datos.familia ?? null,
      unidadMedida: datos.unidadMedida,
      descripcion: datos.descripcion ?? null,
      imagenUrl: datos.imagenUrl ?? null,
      especificacionesTecnicas: datos.especificacionesTecnicas || null,
      monedaPredeterminada: datos.monedaPredeterminada || "MXN",
      clienteId: "default",
    },
    select: PRODUCTO_SELECT,
  });
  return mapear(row);
}

export async function actualizarProducto(
  id: string,
  datos: ProductoInput
): Promise<Producto | null> {
  try {
    const row = await prisma.producto.update({
      where: { id },
      data: {
        codigo: datos.codigo,
        nombre: datos.nombre,
        tipoItem: datos.tipoItem,
        familia: datos.familia ?? null,
        unidadMedida: datos.unidadMedida,
        descripcion: datos.descripcion ?? null,
        imagenUrl: datos.imagenUrl ?? null,
        especificacionesTecnicas: datos.especificacionesTecnicas || null,
        monedaPredeterminada: datos.monedaPredeterminada || "MXN",
      },
      select: PRODUCTO_SELECT,
    });
    return mapear(row);
  } catch {
    return null;
  }
}
