"use server";

import { prisma } from "@/src/lib/prisma";
import {
  generarTablaMaterialesGanados,
  type ItemMaterialGanado,
} from "@/src/lib/plantillasCorreo";

// Variables personalizadas por destinatario (email → { variable: valor }).
type VarsPorDestinatario = Record<string, Record<string, string>>;

type GrupoNotificacion = {
  variables: Record<string, string>;
  destinatarios: string[];
  variablesPorDestinatario: VarsPorDestinatario;
  // Proveedores del grupo que quedaron fuera por no tener correo.
  excluidos: number;
};

export type DatosNotificacionesGanadores = {
  ganadores: GrupoNotificacion;
  noGanadores: GrupoNotificacion;
};

const GRUPO_VACIO: GrupoNotificacion = {
  variables: {},
  destinatarios: [],
  variablesPorDestinatario: {},
  excluidos: 0,
};

const VACIO: DatosNotificacionesGanadores = {
  ganadores: GRUPO_VACIO,
  noGanadores: GRUPO_VACIO,
};

// Correo de contacto de un proveedor: vendedor con fallback al administrativo.
function correoProveedor(p: {
  vendedorCorreo: string | null;
  contactoAdminCorreo: string;
}): string | null {
  const correo = (p.vendedorCorreo ?? "").trim() || (p.contactoAdminCorreo ?? "").trim();
  return correo || null;
}

/**
 * Arma los dos grupos de correo a proveedores tras finalizar la licitación:
 *   - GANADORES: quienes ganaron ≥1 material (NOTIFICACION_GANADORES), con su
 *     tabla de materiales ganados personalizada por proveedor.
 *   - NO GANADORES: quienes cotizaron (tienen ofertas) pero no ganaron nada
 *     (NOTIFICACION_NO_GANADORES).
 * Proveedores sin correo se excluyen y se cuentan en `excluidos`.
 * Nunca lanza: ante cualquier fallo devuelve grupos vacíos (no rompe el cierre).
 */
export async function prepararNotificacionesGanadoresAction(
  licitacionId: string
): Promise<DatosNotificacionesGanadores> {
  try {
    const licitacion = await prisma.licitacion.findUnique({
      where: { id: licitacionId },
      select: { numero: true },
    });
    if (!licitacion) return VACIO;

    // Ganadores: asignaciones agrupadas por proveedor.
    const asignaciones = await prisma.asignacionMaterial.findMany({
      where: { licitacionId },
      select: {
        proveedorId: true,
        cantidadAsignada: true,
        precioUnitario: true,
        moneda: true,
        proveedor: {
          select: { razonSocial: true, vendedorCorreo: true, contactoAdminCorreo: true },
        },
        licitacionItem: {
          select: { producto: { select: { nombre: true, unidadMedida: true } } },
        },
      },
    });

    // Participantes (cotizaron): proveedorIds distintos con ofertas.
    const ofertas = await prisma.ofertaItem.findMany({
      where: { licitacionItem: { licitacionId } },
      select: {
        proveedorId: true,
        proveedor: {
          select: { razonSocial: true, vendedorCorreo: true, contactoAdminCorreo: true },
        },
      },
    });

    const numeroLicitacion = licitacion.numero;

    // ── Grupo GANADORES ───────────────────────────────────────────────────────
    type GanadorAcc = {
      razonSocial: string;
      correo: string | null;
      materiales: ItemMaterialGanado[];
    };
    const ganadoresMap = new Map<string, GanadorAcc>();
    for (const a of asignaciones) {
      const acc =
        ganadoresMap.get(a.proveedorId) ?? {
          razonSocial: a.proveedor.razonSocial,
          correo: correoProveedor(a.proveedor),
          materiales: [],
        };
      acc.materiales.push({
        material: a.licitacionItem.producto.nombre,
        cantidad: a.cantidadAsignada,
        unidad: a.licitacionItem.producto.unidadMedida,
        precioUnitario: a.precioUnitario,
        moneda: a.moneda,
      });
      ganadoresMap.set(a.proveedorId, acc);
    }

    const ganadores = construirGrupo(
      [...ganadoresMap.values()].map((g) => ({
        razonSocial: g.razonSocial,
        correo: g.correo,
        vars: {
          nombreProveedor: g.razonSocial,
          tablaMateriales: generarTablaMaterialesGanados(g.materiales),
        },
      })),
      numeroLicitacion
    );

    // ── Grupo NO GANADORES ────────────────────────────────────────────────────
    const idsGanadores = new Set(ganadoresMap.keys());
    const noGanadoresMap = new Map<
      string,
      { razonSocial: string; correo: string | null }
    >();
    for (const o of ofertas) {
      if (idsGanadores.has(o.proveedorId)) continue; // ganó algo → no va aquí
      if (noGanadoresMap.has(o.proveedorId)) continue;
      noGanadoresMap.set(o.proveedorId, {
        razonSocial: o.proveedor.razonSocial,
        correo: correoProveedor(o.proveedor),
      });
    }

    const noGanadores = construirGrupo(
      [...noGanadoresMap.values()].map((p) => ({
        razonSocial: p.razonSocial,
        correo: p.correo,
        vars: { nombreProveedor: p.razonSocial },
      })),
      numeroLicitacion
    );

    // TEMP diagnóstico: conteos de datos y destinatarios de cada grupo.
    console.log("###COLA_CORREOS### [notificaciones]", {
      asignaciones: asignaciones.length,
      proveedoresGanadores: ganadoresMap.size,
      ofertasFilas: ofertas.length,
      proveedoresNoGanadores: noGanadoresMap.size,
      ganadoresDestinatarios: ganadores.destinatarios.length,
      ganadoresExcluidos: ganadores.excluidos,
      noGanadoresDestinatarios: noGanadores.destinatarios.length,
      noGanadoresExcluidos: noGanadores.excluidos,
    });

    return { ganadores, noGanadores };
  } catch (error) {
    console.error(
      "###COLA_CORREOS### [notificaciones] fallo preparando notificaciones",
      error
    );
    return VACIO;
  }
}

// Construye un GrupoNotificacion desde una lista de proveedores. Excluye los que
// no tienen correo (los cuenta en `excluidos`). La `variables` de referencia
// (para la vista previa del modal) usa el primer destinatario con correo.
function construirGrupo(
  proveedores: {
    razonSocial: string;
    correo: string | null;
    vars: Record<string, string>;
  }[],
  numeroLicitacion: string
): GrupoNotificacion {
  const conCorreo = proveedores.filter((p) => p.correo);
  const excluidos = proveedores.length - conCorreo.length;

  const destinatarios: string[] = [];
  const variablesPorDestinatario: VarsPorDestinatario = {};
  for (const p of conCorreo) {
    const correo = p.correo as string;
    // Si dos proveedores compartieran correo, el primero gana (raro, pero seguro).
    if (variablesPorDestinatario[correo]) continue;
    destinatarios.push(correo);
    variablesPorDestinatario[correo] = p.vars;
  }

  const referencia = conCorreo[0]?.vars ?? {};
  const variables: Record<string, string> = { numeroLicitacion, ...referencia };

  return { variables, destinatarios, variablesPorDestinatario, excluidos };
}
