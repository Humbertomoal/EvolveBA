/**
 * Arma el payload del correo de invitación de una licitación.
 *
 * Este archivo importa Prisma — NUNCA debe importarse desde un Client
 * Component (solo desde Server Components o Server Actions). El TIPO que
 * devuelve vive aparte, en datosInvitacionTypes.ts, que sí es puro y sí puede
 * cruzar al cliente.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * Estas ~60 líneas estaban inline en licitaciones-proceso/[id]/page.tsx, así
 * que el correo de invitación solo podía armarse desde el detalle de una
 * licitación En Proceso. La pantalla de lanzamiento necesita exactamente el
 * mismo payload para notificar a una Programada, y copiarlo habría dejado dos
 * versiones de la misma consulta divergiendo con el tiempo.
 */
import { prisma } from "@/src/lib/prisma";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import { soloCorreoProveedor } from "@/src/lib/correoProveedor";
import {
  fichasDeProveedor,
  filtrarItemsPorMaterialesProveedor,
} from "@/src/lib/proveedorMateriales";
import { getMapaProveedorMateriales } from "@/src/lib/proveedorMaterialesData";
import type {
  DatosInvitacionLicitacion,
  ItemInvitacion,
} from "@/src/lib/datosInvitacionTypes";

function parsearArchivosAdjuntos(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Payload de invitación de una licitación, o null si no existe.
 *
 * NO aplica guarda de propiedad: es una consulta, no una acción. Quien la
 * exponga al cliente debe filtrar por comprador — eso lo hace
 * `getDatosInvitacionAction`.
 */
export async function getDatosInvitacion(
  licitacionId: string
): Promise<DatosInvitacionLicitacion | null> {
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: {
      fechaEjecucion: true,
      fechaFinLicitacion: true,
      instrucciones: true,
      archivosAdjuntos: true,
      invitacionesEnviadasEn: true,
      items: {
        select: {
          productoId: true,
          cantidadSolicitada: true,
          fechaEntrega: true,
          producto: {
            select: {
              nombre: true,
              unidadMedida: true,
              // Fichas técnicas: se adjuntan al correo de invitación/reenvío,
              // filtradas por los materiales que cada proveedor puede cotizar.
              archivosEspecificaciones: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: {
        select: {
          // vendedorCorreo es OBLIGATORIO en este select: correoDeProveedor()
          // lo prefiere sobre el administrativo, y si no viene en el payload
          // caería al respaldo SIEMPRE sin que nada lo delate.
          proveedor: {
            select: {
              id: true,
              razonSocial: true,
              vendedorCorreo: true,
              contactoAdminCorreo: true,
            },
          },
        },
        orderBy: { invitadoEn: "asc" },
      },
    },
  });

  if (!licitacion) return null;

  const usuarioActual = await getUsuarioActual();
  const correosProveedoresInvitados = licitacion.proveedoresInvitados
    .map((lp: any) => soloCorreoProveedor(lp.proveedor))
    .filter((c: string): c is string => !!c);

  const itemsConProductoId = licitacion.items.map((item: any) => ({
    productoId: item.productoId,
    producto: item.producto.nombre,
    cantidad: item.cantidadSolicitada,
    unidad: item.producto.unidadMedida,
    fechaRequerida: item.fechaEntrega?.toISOString() ?? null,
  }));

  // Items filtrados al catálogo de cada proveedor invitado (misma lógica que
  // ve el proveedor en su portal), para personalizar tablaMateriales por
  // destinatario en el correo de invitación/reenvío.
  const mapaMaterialesProveedores = await getMapaProveedorMateriales();

  // productoId → JSON crudo de sus fichas técnicas, para fichasDeProveedor.
  const fichasPorProducto: Record<string, string | null | undefined> = {};
  for (const item of licitacion.items as any[]) {
    if (item.productoId in fichasPorProducto) continue;
    fichasPorProducto[item.productoId] = item.producto.archivosEspecificaciones;
  }

  const itemsPorProveedor: Record<string, ItemInvitacion[]> = {};
  const nombrePorDestinatario: Record<string, string> = {};
  const fichasPorDestinatario: Record<string, string[]> = {};
  for (const lp of licitacion.proveedoresInvitados) {
    const correo = soloCorreoProveedor((lp as any).proveedor);
    if (!correo) continue;
    const materialesIds = mapaMaterialesProveedores[(lp as any).proveedor.id] ?? [];
    const itemsFiltrados = filtrarItemsPorMaterialesProveedor(itemsConProductoId, materialesIds);
    itemsPorProveedor[correo] = itemsFiltrados.map(({ productoId: _productoId, ...resto }) => resto);
    nombrePorDestinatario[correo] = (lp as any).proveedor.razonSocial;
    // Mismo filtro por catálogo que la tabla de materiales, para que los
    // adjuntos y la tabla del correo hablen de los mismos materiales.
    fichasPorDestinatario[correo] = fichasDeProveedor(
      itemsConProductoId,
      materialesIds,
      fichasPorProducto
    );
  }

  return {
    fechaInicio: licitacion.fechaEjecucion?.toISOString() ?? null,
    fechaFin: licitacion.fechaFinLicitacion?.toISOString() ?? null,
    instrucciones: licitacion.instrucciones ?? "",
    archivosAdjuntos: parsearArchivosAdjuntos(licitacion.archivosAdjuntos),
    items: itemsConProductoId.map(({ productoId: _productoId, ...resto }) => resto),
    itemsPorProveedor,
    nombrePorDestinatario,
    fichasPorDestinatario,
    invitacionesEnviadasEn: licitacion.invitacionesEnviadasEn?.toISOString() ?? null,
    destinatarios: [...new Set(correosProveedoresInvitados)],
    excluidos: licitacion.proveedoresInvitados.length - correosProveedoresInvitados.length,
    nombreComprador: usuarioActual?.nombre ?? "",
    correoComprador: usuarioActual?.email ?? "",
  };
}
