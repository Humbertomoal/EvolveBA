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
    // De aquí sale el orden de las LÍNEAS de la orden de compra: se crean en
    // este orden y las pantallas y el PDF las leen igual. Por partida
    // (posicion) y, dentro de una partida repartida entre proveedores, por
    // lugar del ganador.
    orderBy: [{ licitacionItem: { posicion: "asc" } }, { orden: "asc" }],
  });

  if (asignaciones.length === 0) return;

  // Marca de producto similar de la OFERTA que origino cada asignacion.
  // AsignacionMaterial guarda (licitacionItemId, proveedorId, ronda), que es
  // exactamente la clave unica de OfertaItem, asi que la oferta siempre es
  // recuperable. Se copia a la linea porque la OC es un documento: congela
  // lo que se compro, igual que ya congela productoNombre y precioUnitario.
  const claveOferta = (
    licitacionItemId: string,
    proveedorId: string,
    ronda: number
  ) => `${licitacionItemId}:${proveedorId}:${ronda}`;
  const ofertasOrigen = await prisma.ofertaItem.findMany({
    where: {
      licitacionItemId: { in: asignaciones.map((a) => a.licitacionItemId) },
    },
    select: {
      licitacionItemId: true,
      proveedorId: true,
      ronda: true,
      esProductoSimilar: true,
      productoSimilarDetalle: true,
    },
  });
  const similarPorClave = new Map(
    ofertasOrigen.map((o) => [
      claveOferta(o.licitacionItemId, o.proveedorId, o.ronda),
      o,
    ])
  );

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
            // Ausente (reasignacion manual con otra ronda, filas antiguas) cae
            // a "no es similar": el lado seguro es no inventar una marca.
            esProductoSimilar:
              similarPorClave.get(
                claveOferta(a.licitacionItemId, a.proveedorId, a.ronda)
              )?.esProductoSimilar ?? false,
            productoSimilarDetalle:
              similarPorClave.get(
                claveOferta(a.licitacionItemId, a.proveedorId, a.ronda)
              )?.productoSimilarDetalle ?? null,
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
