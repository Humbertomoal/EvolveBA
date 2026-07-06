import { notFound } from "next/navigation";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import DetalleFinalizadaView, {
  type DetalleFinalizadaProps,
} from "./_components/DetalleFinalizadaView";

export default async function DetalleFinalizadaPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      jerarquia: true,
      tipoLicitacion: true,
      estado: true,
      modoLicitacion: true,
      fechaCreacion: true,
      updatedAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cantidadSolicitada: true,
          producto: { select: { nombre: true, unidadMedida: true } },
          asignaciones: {
            orderBy: { orden: "asc" },
            select: {
              id: true,
              cantidadAsignada: true,
              precioUnitario: true,
              estatusProveedor: true,
              proveedor: { select: { id: true, razonSocial: true } },
              lineas: {
                take: 1,
                select: { ordenCompra: { select: { numero: true } } },
              },
            },
          },
          ofertas: {
            orderBy: [{ ronda: "asc" }, { precioUnitario: "asc" }],
            select: {
              proveedorId: true,
              ronda: true,
              precioUnitario: true,
              cantidadDisponible: true,
              proveedor: { select: { id: true, razonSocial: true } },
            },
          },
        },
      },
    },
  });

  if (!lic) notFound();

  // ── Build "Ganadores" tab data ─────────────────────────────────────────────

  const itemsAsignados: DetalleFinalizadaProps["items"] = (lic.items as any[]).map(
    (item) => ({
      id: item.id,
      productoNombre: item.producto.nombre,
      unidadMedida: item.producto.unidadMedida,
      cantidadSolicitada: item.cantidadSolicitada,
      asignaciones: item.asignaciones.map((a: any) => ({
        id: a.id,
        proveedorId: a.proveedor.id,
        proveedorNombre: a.proveedor.razonSocial,
        cantidadAsignada: a.cantidadAsignada,
        precioUnitario: a.precioUnitario,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        moneda: (a as any).moneda ?? "MXN",
        estatusProveedor: a.estatusProveedor,
        ordenNumero: a.lineas[0]?.ordenCompra?.numero ?? null,
      })),
    })
  );

  // ── Build "Historial de Pujas" tab data ───────────────────────────────────

  let historial: DetalleFinalizadaProps["historial"] = null;

  if (lic.modoLicitacion !== "Manual") {
    // Collect unique providers (preserving order of first appearance)
    const provMap = new Map<string, string>(); // id -> razonSocial
    for (const item of lic.items) {
      for (const oferta of item.ofertas) {
        if (!provMap.has(oferta.proveedorId)) {
          provMap.set(oferta.proveedorId, oferta.proveedor.razonSocial);
        }
      }
    }
    const proveedores = [...provMap.entries()].map(([id, nombre]) => ({
      id,
      nombre,
    }));

    // Collect winners: itemId -> Set<proveedorId>
    const ganadoresMap = new Map<string, Set<string>>();
    for (const item of lic.items) {
      const winners = new Set<string>(item.asignaciones.map((a: any) => a.proveedor.id));
      ganadoresMap.set(item.id, winners);
    }

    const itemsHistorial = lic.items
      .filter((item: any) => item.ofertas.length > 0)
      .map((item: any) => {
        const rondas = [...new Set(item.ofertas.map((o: any) => o.ronda))].sort(
          (a: any, b: any) => a - b
        );

        const filas = rondas.map((ronda: any) => {
          const ofertas: Record<string, number | null> = {};
          for (const prov of proveedores) {
            const oferta = item.ofertas.find(
              (o: any) => o.ronda === ronda && o.proveedorId === prov.id
            );
            ofertas[prov.id] = oferta?.precioUnitario ?? null;
          }
          return { ronda, ofertas };
        });

        return {
          id: item.id,
          productoNombre: item.producto.nombre,
          unidadMedida: item.producto.unidadMedida,
          cantidadSolicitada: item.cantidadSolicitada,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          moneda: (item as any).moneda ?? "MXN",
          filas,
          ganadorIds: [...(ganadoresMap.get(item.id) ?? new Set<string>())],
        };
      });

    historial = { proveedores, items: itemsHistorial };
  }

  const props: DetalleFinalizadaProps = {
    licitacion: {
      id: lic.id,
      numero: lic.numero,
      jerarquia: lic.jerarquia,
      tipoLicitacion: lic.tipoLicitacion,
      estado: lic.estado,
      modoLicitacion: lic.modoLicitacion,
      fechaCreacion: lic.fechaCreacion.toISOString(),
      fechaFinalizacion: lic.updatedAt.toISOString(),
    },
    items: itemsAsignados,
    historial,
    basePath,
  };

  return <DetalleFinalizadaView {...props} />;
}
