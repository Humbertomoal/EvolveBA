"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  registrarCambioEstado,
  getUsuarioIdActual,
  ESTADO_ESPERANDO_DECISION,
} from "@/src/lib/estadoLog";
import {
  esCapturaValida,
  estadoSinCosto,
  flagsDeEstado,
  type EstadoPartida,
} from "@/src/lib/ofertaValida";

export type OfertaManual = {
  licitacionItemId: string;
  proveedorId: string;
  precioUnitario: number;
  cantidadDisponible: number;
  fechaEstimadaEntrega: string | null;
  /**
   * Estado de la partida, igual que en el formulario del proveedor. Hasta ahora
   * la captura manual no lo tenía: el comprador que capturaba por teléfono no
   * podía expresar "no dispongo" —y menos "no aplica"—, así que esas respuestas
   * se perdían o acababan como un 0 crudo, que es exactamente el dato ambiguo
   * que el tercer estado viene a eliminar.
   */
  estado: EstadoPartida;
};

export type FechaRequeridaManual = {
  licitacionItemId: string;
  fechaEntrega: string | null;
};

async function upsertOfertas(ofertas: OfertaManual[]) {
  for (const o of ofertas) {
    const noDispone = o.estado === "no_dispongo";
    const sinCosto = estadoSinCosto(o.estado);

    // Fila en blanco: ni precio, ni cantidad, ni estado declarado. No es una
    // respuesta, es que el comprador no capturó nada para ese proveedor.
    // "No dispongo" y "no aplica" SÍ son respuestas y por eso se guardan.
    if (!sinCosto && o.precioUnitario <= 0 && o.cantidadDisponible <= 0) continue;

    // Misma validación que la del proveedor: un 0 sin marca no entra. Es la
    // guarda que impide que la captura manual se vuelva la puerta de atrás por
    // la que regresan los ceros ambiguos.
    if (!esCapturaValida({ ...o, ...flagsDeEstado(o.estado) })) continue;

    // Mismas reglas de normalización que ofertasActions: el precio se anula en
    // los dos estados sin costo; la cantidad y la fecha SOLO en "no dispongo",
    // porque quien marca "no aplica" sí va a surtir la partida y necesita
    // cantidad para poder ganarla.
    const fechaEstimadaEntrega =
      noDispone || !o.fechaEstimadaEntrega
        ? null
        : new Date(o.fechaEstimadaEntrega);
    const datos = {
      precioUnitario: sinCosto ? 0 : o.precioUnitario,
      cantidadDisponible: noDispone ? 0 : o.cantidadDisponible,
      ...flagsDeEstado(o.estado),
      fechaEstimadaEntrega,
    };

    await prisma.ofertaItem.upsert({
      where: {
        licitacionItemId_proveedorId_ronda: {
          licitacionItemId: o.licitacionItemId,
          proveedorId: o.proveedorId,
          ronda: 1,
        },
      },
      create: {
        licitacionItemId: o.licitacionItemId,
        proveedorId: o.proveedorId,
        ronda: 1,
        puedeCumplirFecha: true,
        ...datos,
      },
      update: datos,
    });
  }
}

async function actualizarFechasRequeridas(fechas: FechaRequeridaManual[]) {
  for (const f of fechas) {
    await prisma.licitacionItem.update({
      where: { id: f.licitacionItemId },
      data: { fechaEntrega: f.fechaEntrega ? new Date(f.fechaEntrega) : null },
    });
  }
}

export async function guardarAvanceCapturaAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  fechasRequeridas: FechaRequeridaManual[],
  basePath: string
): Promise<void> {
  await Promise.all([upsertOfertas(ofertas), actualizarFechasRequeridas(fechasRequeridas)]);
  revalidatePath(
    `${basePath}/comprador/licitaciones-proceso/${licitacionId}/captura-manual`
  );
}

export async function finalizarCapturaManualAction(
  licitacionId: string,
  ofertas: OfertaManual[],
  fechasRequeridas: FechaRequeridaManual[],
  basePath: string
): Promise<void> {
  await Promise.all([upsertOfertas(ofertas), actualizarFechasRequeridas(fechasRequeridas)]);

  const anterior = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { estado: true, esperandoDecision: true },
  });

  await prisma.licitacion.update({
    where: { id: licitacionId },
    data: { estado: "Cerrada", fechaCerrada: new Date() },
  });

  const estadoAnterior = anterior?.esperandoDecision
    ? ESTADO_ESPERANDO_DECISION
    : anterior?.estado ?? null;
  await registrarCambioEstado(
    licitacionId,
    estadoAnterior,
    "Cerrada",
    await getUsuarioIdActual()
  );

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
