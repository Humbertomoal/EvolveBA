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
  createdAt: Date;
};

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
    createdAt: p.createdAt,
  };
}

export async function getProductos(): Promise<Producto[]> {
  const rows = await prisma.producto.findMany({
    where: { eliminado: false },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapear);
}

export async function getProductoById(id: string): Promise<Producto | null> {
  const row = await prisma.producto.findUnique({ where: { id } });
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
      clienteId: "default",
    },
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
      },
    });
    return mapear(row);
  } catch {
    return null;
  }
}
