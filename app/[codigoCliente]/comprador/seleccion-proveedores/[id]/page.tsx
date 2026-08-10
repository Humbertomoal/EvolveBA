import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { parseTiposCambio } from "@/src/lib/conversionMoneda";
import { soloOfertasValidas } from "@/src/lib/ofertaValida";
import AsignacionForm from "./_components/AsignacionForm";
import SeguimientoView from "./_components/SeguimientoView";
import type {
  AsignacionDetalle,
  ItemParaAsignacion,
  OfertaParaDropdown,
} from "./_components/types";

export default async function DetalleSeleccionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const licitacion = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      jerarquia: true,
      tipoLicitacion: true,
      tiempoConfirmacionHoras: true,
      importeVenta: true,
      costoObjetivo: true,
      tiposCambio: true,
      monedaConsolidacion: true,
      estado: true,
      items: {
        select: {
          id: true,
          cantidadSolicitada: true,
          fechaEntrega: true,
          createdAt: true,
          // La moneda de la línea vive en LicitacionItem (NO en OfertaItem, ver
          // schema.prisma). Sin este campo cada línea caía al default "MXN" y
          // los subtotales de un material en USD se mostraban y GUARDABAN en MXN.
          moneda: true,
          producto: { select: { nombre: true, unidadMedida: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!licitacion) {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">
          Licitación no encontrada
        </h1>
        <Link
          href={`${basePath}/comprador/seleccion-proveedores`}
          className="w-fit text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Volver
        </Link>
      </div>
    );
  }

  // Asignaciones existentes
  const asignacionesExistentes = await prisma.asignacionMaterial.findMany({
    where: { licitacionId: id },
    include: {
      proveedor: { select: { razonSocial: true } },
      licitacionItem: {
        include: { producto: { select: { nombre: true, unidadMedida: true } } },
      },
    },
    orderBy: [{ licitacionItemId: "asc" }, { orden: "asc" }],
  });

  // Todas las ofertas para esta licitación (para dropdowns).
  //
  // El filtro va AQUÍ, en la fuente, y no en los dos bloques que la consumen:
  // ambos construyen un `bestPerProveedor` que se queda con la PRIMERA oferta de
  // cada proveedor, y como esta consulta ordena por precio ascendente, esa
  // primera es la más barata. Con un 0 de por medio, el proveedor que dejó la
  // partida en blanco quedaba preseleccionado como GANADOR a $0 en
  // AsignacionForm — a un descuido de emitir una orden de compra en cero.
  const todasLasOfertasCrudas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId: id } },
    include: { proveedor: { select: { id: true, razonSocial: true } } },
    orderBy: { precioUnitario: "asc" },
  });
  const todasLasOfertas = soloOfertasValidas(todasLasOfertasCrudas);

  // ── Construir items para la forma de asignación ──────────────────────────────
  // `item` sin anotar como `any` a propósito: así el tipo inferido por Prisma
  // manda, y si alguien vuelve a quitar `moneda` del select de arriba esto deja
  // de compilar en vez de caer silenciosamente a "MXN".
  const items: ItemParaAsignacion[] = licitacion.items.map((item) => {
    const itemOfertas = todasLasOfertas.filter(
      (o: any) => o.licitacionItemId === item.id
    );

    // Mejor oferta por proveedor
    const bestPerProveedor = new Map<string, (typeof itemOfertas)[0]>();
    for (const o of itemOfertas) {
      if (!bestPerProveedor.has(o.proveedorId)) {
        bestPerProveedor.set(o.proveedorId, o);
      }
    }

    const ofertas: OfertaParaDropdown[] = [...bestPerProveedor.values()]
      .sort((a: any, b: any) => a.precioUnitario - b.precioUnitario)
      .map((o: any) => ({
        proveedorId: o.proveedorId,
        proveedorNombre: o.proveedor.razonSocial,
        precioUnitario: o.precioUnitario,
        cantidadDisponible: o.cantidadDisponible,
        ronda: o.ronda,
        puedeCumplirFecha: o.puedeCumplirFecha,
        fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
      }));

    return {
      licitacionItemId: item.id,
      productoNombre: item.producto.nombre,
      unidadMedida: item.producto.unidadMedida,
      cantidadSolicitada: item.cantidadSolicitada,
      fechaEntrega: item.fechaEntrega?.toISOString() ?? null,
      moneda: item.moneda,
      ofertas,
    };
  });

  // Proveedores distintos que participaron (para el selector del histórico de pujas)
  // Tupla anotada en vez de `(o: any)`: con el `any`, new Map() no podía
  // resolver la forma [clave, valor] y devolvía Map<unknown, unknown>, lo que
  // obligaba al `as string` de abajo. Con el tipo real de Prisma no hace falta.
  const proveedoresParticipantes = [
    ...new Map(
      todasLasOfertas.map((o): [string, string] => [
        o.proveedorId,
        o.proveedor.razonSocial,
      ])
    ).entries(),
  ].map(([proveedorId, nombre]) => ({ id: proveedorId, nombre }));

  const licitacionInfo = {
    id: licitacion.id,
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia,
    tipoLicitacion: licitacion.tipoLicitacion,
    tiempoConfirmacionHoras: licitacion.tiempoConfirmacionHoras,
    importeVenta: licitacion.importeVenta,
    costoObjetivo: licitacion.costoObjetivo,
    estado: licitacion.estado,
    tiposCambio: parseTiposCambio(licitacion.tiposCambio),
    monedaConsolidacion: (licitacion as any).monedaConsolidacion ?? "MXN",
  };

  // ── Si ya hay asignaciones: vista de seguimiento ─────────────────────────────
  if (asignacionesExistentes.length > 0) {
    // Fetch OC numbers for each asignacion (post-migration, via OrdenCompraLinea)
    const asignacionIds = asignacionesExistentes.map((a: any)=> a.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineasOC: any[] = asignacionIds.length > 0
      ? await (prisma as any).ordenCompraLinea.findMany({
          where: { asignacionId: { in: asignacionIds } },
          select: {
            asignacionId: true,
            ordenCompra: { select: { numero: true } },
          },
        })
      : [];
    const ocMap = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineasOC.map((l: any) => [l.asignacionId, l.ordenCompra.numero])
    );

    // `a` sin anotar como `any`: el tipo inferido por Prisma (include trae todos
    // los escalares, `moneda` incluida) es lo que protege este mapeo.
    const asignaciones: AsignacionDetalle[] = asignacionesExistentes.map(
      (a) => {
        // Ofertas alternativas para reasignación (todos excepto el actual proveedor)
        const itemOfertas = todasLasOfertas.filter(
          (o: any) => o.licitacionItemId === a.licitacionItemId
        );
        const bestPerProveedor = new Map<string, (typeof itemOfertas)[0]>();
        for (const o of itemOfertas) {
          if (!bestPerProveedor.has(o.proveedorId)) {
            bestPerProveedor.set(o.proveedorId, o);
          }
        }
        const ofertasAlternativas: OfertaParaDropdown[] = [
          ...bestPerProveedor.values(),
        ]
          .filter((o: any) => o.proveedorId !== a.proveedorId)
          .sort((a: any, b: any) => a.precioUnitario - b.precioUnitario)
          .map((o: any) => ({
            proveedorId: o.proveedorId,
            proveedorNombre: o.proveedor.razonSocial,
            precioUnitario: o.precioUnitario,
            cantidadDisponible: o.cantidadDisponible,
            ronda: o.ronda,
            puedeCumplirFecha: o.puedeCumplirFecha,
            fechaEstimadaEntrega: o.fechaEstimadaEntrega?.toISOString() ?? null,
          }));

        return {
          id: a.id,
          licitacionItemId: a.licitacionItemId,
          productoNombre: a.licitacionItem.producto.nombre,
          unidadMedida: a.licitacionItem.producto.unidadMedida,
          cantidadSolicitada: a.licitacionItem.cantidadSolicitada,
          // Moneda congelada al asignar. OJO: en filas creadas antes del fix del
          // select de arriba puede venir "MXN" aunque el material fuera USD.
          moneda: a.moneda,
          proveedorId: a.proveedorId,
          proveedorNombre: a.proveedor.razonSocial,
          cantidadAsignada: a.cantidadAsignada,
          precioUnitario: a.precioUnitario,
          ronda: a.ronda,
          orden: a.orden,
          fechaObjetivo: a.fechaObjetivo?.toISOString() ?? null,
          fechaEstimadaProveedor:
            a.fechaEstimadaProveedor?.toISOString() ?? null,
          estatusProveedor: a.estatusProveedor,
          fechaLimiteConfirmacion:
            a.fechaLimiteConfirmacion?.toISOString() ?? null,
          motivoRechazo: a.motivoRechazo,
          ofertasAlternativas,
          ordenNumero: ocMap.get(a.id) ?? null,
        };
      }
    );

    return (
      <SeguimientoView
        licitacion={licitacionInfo}
        asignaciones={asignaciones}
        basePath={basePath}
        codigoCliente={codigoCliente}
        proveedoresParticipantes={proveedoresParticipantes}
      />
    );
  }

  // ── Vista de asignación ──────────────────────────────────────────────────────
  return (
    <AsignacionForm
      licitacion={licitacionInfo}
      items={items}
      basePath={basePath}
      codigoCliente={codigoCliente}
      proveedoresParticipantes={proveedoresParticipantes}
    />
  );
}
