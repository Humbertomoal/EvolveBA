import { prisma } from "./prisma";

/**
 * Creates OrdenCompra records for each supplier in a licitacion.
 * Idempotent — skips any (licitacionId, proveedorId) pair that already has an OC.
 * Pass soloProveedorId to limit to one specific supplier.
 */
export async function crearOrdenesCompraParaLicitacion(
  licitacionId: string,
  soloProveedorId?: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const asignaciones = await prisma.asignacionMaterial.findMany({
    where: { licitacionId, ...(soloProveedorId ? { proveedorId: soloProveedorId } : {}) },
    include: {
      licitacionItem: {
        include: { producto: { select: { nombre: true, unidadMedida: true } } },
      },
    },
  });

  if (asignaciones.length === 0) return;

  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { clienteId: true },
  });
  if (!licitacion) return;

  // Group by proveedor
  const byProveedor = new Map<string, typeof asignaciones>();
  for (const a of asignaciones) {
    if (!byProveedor.has(a.proveedorId)) byProveedor.set(a.proveedorId, []);
    byProveedor.get(a.proveedorId)!.push(a);
  }

  for (const [proveedorId, lineas] of byProveedor) {
    const existing = await db.ordenCompra.findFirst({
      where: { licitacionId, proveedorId },
    });
    if (existing) continue;

    const count = await db.ordenCompra.count();
    const numero = `OC-${String(count + 1).padStart(4, "0")}`;

    const fechaMs = lineas
      .map((l: any) => (l.fechaEstimadaProveedor ?? l.fechaObjetivo)?.getTime())
      .filter((t: any): t is number => t !== undefined);
    const fechaEstimadaEntrega = fechaMs.length > 0 ? new Date(Math.max(...fechaMs)) : null;

    await db.ordenCompra.create({
      data: {
        numero,
        licitacionId,
        proveedorId,
        clienteId: licitacion.clienteId,
        estado: "Pendiente",
        fechaEstimadaEntrega,
        fechaPendiente: new Date(),
        lineas: {
          create: lineas.map((a: any) => ({
            asignacionId: a.id,
            productoNombre: a.licitacionItem.producto.nombre,
            cantidad: a.cantidadAsignada,
            unidadMedida: a.licitacionItem.producto.unidadMedida,
            precioUnitario: a.precioUnitario,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            moneda: (a as any).moneda ?? "MXN",
            fechaEntregaObjetivo: a.fechaObjetivo,
            fechaEstimadaProveedor: a.fechaEstimadaProveedor,
            subtotal: a.cantidadAsignada * a.precioUnitario,
          })),
        },
      },
    });
  }
}
