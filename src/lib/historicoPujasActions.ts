"use server";

import { prisma } from "@/src/lib/prisma";

export type FilaHistoricoPuja = {
  ronda: number;
  proveedorId: string;
  proveedorNombre: string;
  productoNombre: string;
  cantidadDisponible: number;
  precioUnitario: number;
  moneda: string;
  subtotal: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
  fechaPuja: string;
};

const LIMITE_FILAS = 500;

export async function getHistoricoPujas(
  licitacionId: string,
  proveedorId?: string,
  ronda?: number
): Promise<{ filas: FilaHistoricoPuja[]; truncado: boolean }> {
  const where = {
    licitacionItem: { licitacionId },
    ...(proveedorId ? { proveedorId } : {}),
    ...(ronda ? { ronda } : {}),
  };

  const [total, ofertas] = await Promise.all([
    prisma.ofertaItem.count({ where }),
    prisma.ofertaItem.findMany({
      where,
      include: {
        proveedor: { select: { razonSocial: true } },
        licitacionItem: { select: { producto: { select: { nombre: true } } } },
      },
      orderBy: [
        { ronda: "asc" },
        { proveedor: { razonSocial: "asc" } },
        { licitacionItem: { producto: { nombre: "asc" } } },
      ],
      take: LIMITE_FILAS,
    }),
  ]);

  const filas: FilaHistoricoPuja[] = ofertas.map((o) => ({
    ronda: o.ronda,
    proveedorId: o.proveedorId,
    proveedorNombre: o.proveedor.razonSocial,
    productoNombre: o.licitacionItem.producto.nombre,
    cantidadDisponible: o.cantidadDisponible,
    precioUnitario: o.precioUnitario,
    moneda: o.moneda,
    subtotal: o.cantidadDisponible * o.precioUnitario,
    puedeCumplirFecha: o.puedeCumplirFecha,
    fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
    fechaPuja: o.createdAt.toISOString(),
  }));

  return { filas, truncado: total > LIMITE_FILAS };
}
