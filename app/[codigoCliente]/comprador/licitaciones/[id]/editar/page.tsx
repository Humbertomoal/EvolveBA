import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getMapaProveedorMateriales } from "@/src/lib/proveedorMaterialesData";
import { getProductos } from "@/src/lib/productos";
import { getProveedores } from "@/src/lib/proveedores";
import { fechaParaInput } from "@/src/lib/dateUtils";
import { parseTiposCambio } from "@/src/lib/conversionMoneda";
import { getCatalogosActivos } from "@/src/lib/getCatalogos";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import LicitacionForm, { type PreDatos, type UnidadDuracion } from "../../nueva/_components/LicitacionForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

function minutosAValorYUnidad(minutos: number): { valor: string; unidad: UnidadDuracion } {
  if (minutos % 1440 === 0) return { valor: String(minutos / 1440), unidad: "dias" };
  if (minutos % 60 === 0) return { valor: String(minutos / 60), unidad: "horas" };
  return { valor: String(minutos), unidad: "minutos" };
}

function parsearArchivosAdjuntos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EditarLicitacionPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const licitacion = await prisma.licitacion.findUnique({
    where: { id },
    include: {
      // A DIFERENCIA del resto de la app, aquí NO se filtran las partidas
      // ocultas: esta es la única pantalla desde donde se restauran, así que
      // tienen que verse (tachadas). El formulario las manda de vuelta con su
      // marca para que el servidor no las restaure sin querer.
      items: {
        include: {
          producto: { select: { unidadMedida: true } },
          // Con qué se puede: una partida con ofertas/asignaciones/borrador de
          // precio se OCULTA al quitarla; una sin nada se borra de verdad.
          _count: { select: { ofertas: true, asignaciones: true, seleccionesPrecio: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: true,
    },
  });

  if (!licitacion) {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] p-8">
        <h1 className="text-xl font-semibold text-zinc-900">Licitación no encontrada</h1>
        <p className="text-sm text-zinc-500">
          No existe una licitación con el identificador proporcionado, o fue eliminada.
        </p>
        <Link
          href={`${basePath}/comprador/licitaciones/lanzamiento`}
          className="w-fit rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
        >
          Volver a Lanzamiento
        </Link>
      </div>
    );
  }

  const { valor: duracionValor, unidad: duracionUnidad } = minutosAValorYUnidad(
    licitacion.duracionRondaMinutos
  );

  const inicial: PreDatos = {
    id: licitacion.id,
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia ?? "",
    tipoLicitacion: licitacion.tipoLicitacion ?? "",
    costoObjetivo: licitacion.costoObjetivo !== null ? String(licitacion.costoObjetivo) : "",
    fechaEjecucion: fechaParaInput(licitacion.fechaEjecucion),
    fechaFinLicitacion: fechaParaInput((licitacion as any).fechaFinLicitacion ?? null),
    fechaInicioRangoEntrega: toDateInput(licitacion.fechaInicioRangoEntrega),
    fechaFinRangoEntrega: toDateInput(licitacion.fechaFinRangoEntrega),
    duracionValor,
    duracionUnidad,
    maxRondas: String(licitacion.maxRondas),
    instrucciones: licitacion.instrucciones ?? "",
    archivosAdjuntos: parsearArchivosAdjuntos(licitacion.archivosAdjuntos),
    estado: licitacion.estado,
    modoLicitacion: licitacion.modoLicitacion,
    items: licitacion.items.map((item: any) => ({
      // `_id` es la llave de React; `id` es la identidad en la base, que el
      // guardado necesita para ACTUALIZAR esta partida en vez de recrearla.
      _id: item.id,
      id: item.id,
      eliminado: item.eliminado,
      tieneDependencias:
        item._count.ofertas > 0 ||
        item._count.asignaciones > 0 ||
        item._count.seleccionesPrecio > 0,
      productoId: item.productoId,
      unidadMedida: item.producto.unidadMedida,
      especificacion: item.especificacion ?? "",
      fechaEntrega: toDateInput(item.fechaEntrega),
      cantidadSolicitada: String(item.cantidadSolicitada),
      precioObjetivo: item.precioObjetivo !== null ? String(item.precioObjetivo) : "",
      moneda: item.moneda ?? "MXN",
    })),
    proveedoresInvitados: licitacion.proveedoresInvitados.map((p: any) => p.proveedorId),
    tiposCambio: parseTiposCambio(licitacion.tiposCambio),
    monedaConsolidacion: (licitacion as any).monedaConsolidacion ?? "MXN",
  };

  const [productos, proveedores, proveedorMateriales, jerarquias, tiposLicitacion, monedas, usuarioActual] =
    await Promise.all([
      getProductos(),
      getProveedores(),
      getMapaProveedorMateriales(),
      getCatalogosActivos("JERARQUIA"),
      getCatalogosActivos("TIPO_LICITACION"),
      getCatalogosActivos("MONEDA"),
      getUsuarioActual(),
    ]);
  const catalogos = { jerarquias, tiposLicitacion, monedas };

  return (
    <LicitacionForm
      basePath={basePath}
      codigoCliente={codigoCliente}
      productos={productos}
      proveedores={proveedores}
      proveedorMateriales={proveedorMateriales}
      inicial={inicial}
      catalogos={catalogos}
      usuarioActual={usuarioActual}
    />
  );
}
