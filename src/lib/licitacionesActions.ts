"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { parsearFechaMexico } from "@/src/lib/dateUtils";

type ItemInput = {
  productoId: string;
  unidadMedida: string;
  especificacion: string;
  fechaEntrega: string;
  cantidadSolicitada: string;
  precioObjetivo: string;
  moneda: string;
};

export type ResultadoGuardarLicitacion = {
  destino: string;
  // Estado de la licitación ANTES de este guardado — "Borrador" (o
  // inexistente, si es de nueva creación) significa que nunca se le ha
  // notificado a los proveedores; "Programada"/"En Proceso" significa que
  // ya se lanzó al menos una vez.
  estadoPrevio: string;
  // fechaEjecucion tal como estaba en la BD antes de este guardado (ISO,
  // instante real) — null si nunca tuvo fecha o es de nueva creación.
  fechaAnteriorISO: string | null;
  // true si fechaEjecucion cambió respecto al valor leído de la BD
  // (comparado ahí mismo, no contra un valor cacheado del cliente).
  fechaCambio: boolean;
};

export type LicitacionInput = {
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  costoObjetivo: number | null;
  fechaEjecucion: string | null;
  fechaFinLicitacion: string | null;
  fechaInicioRangoEntrega: string | null;
  fechaFinRangoEntrega: string | null;
  duracionRondaMinutos: number;
  maxRondas: number;
  instrucciones: string | null;
  archivosAdjuntos: string[];
  estado: string;
  modoLicitacion: string;
  items: ItemInput[];
  proveedoresInvitados: string[];
};

// Reglas de validación que también se hacen en el cliente, pero se repiten
// aquí por seguridad — un cliente modificado no debe poder saltárselas.
function validarFechas(datos: LicitacionInput) {
  if (
    datos.fechaEjecucion &&
    datos.fechaFinLicitacion &&
    parsearFechaMexico(datos.fechaFinLicitacion)! <=
      parsearFechaMexico(datos.fechaEjecucion)!
  ) {
    throw new Error(
      "La fecha fin de licitación debe ser posterior a la fecha de inicio."
    );
  }
}

export async function crearLicitacionAction(
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardarLicitacion> {
  validarFechas(datos);

  const cookieStore = await cookies();
  const rawCompradorId = cookieStore.get("cyrgo_comprador_id")?.value ?? "default";
  // "__todos__" means the user has supervisor access — attribute to "default" on create
  const compradorId = rawCompradorId === "__todos__" ? "default" : rawCompradorId;

  const esManualEnProceso =
    datos.modoLicitacion === "Manual" && datos.estado === "En Proceso";

  const licitacion = await prisma.licitacion.create({
    data: {
      numero: datos.numero,
      jerarquia: datos.jerarquia,
      tipoLicitacion: datos.tipoLicitacion,
      costoObjetivo: datos.costoObjetivo,
      fechaEjecucion: parsearFechaMexico(datos.fechaEjecucion),
      fechaFinLicitacion: parsearFechaMexico(datos.fechaFinLicitacion),
      fechaInicioRangoEntrega: datos.fechaInicioRangoEntrega
        ? new Date(datos.fechaInicioRangoEntrega)
        : null,
      fechaFinRangoEntrega: datos.fechaFinRangoEntrega
        ? new Date(datos.fechaFinRangoEntrega)
        : null,
      duracionRondaMinutos: datos.duracionRondaMinutos,
      maxRondas: datos.maxRondas,
      instrucciones: datos.instrucciones,
      archivosAdjuntos:
        datos.archivosAdjuntos.length > 0 ? JSON.stringify(datos.archivosAdjuntos) : null,
      estado: datos.estado,
      modoLicitacion: datos.modoLicitacion,
      compradorId,
      clienteId: "default",
      ...(esManualEnProceso ? { rondaActual: 1, inicioRondaActual: new Date(), fechaInicioLicitacion: new Date() } : {}),
    },
  });

  const itemsValidos = datos.items.filter((item) => item.productoId !== "");
  if (itemsValidos.length > 0) {
    await prisma.licitacionItem.createMany({
      data: itemsValidos.map((item: any) => ({
        licitacionId: licitacion.id,
        productoId: item.productoId,
        especificacion: item.especificacion || null,
        fechaEntrega: item.fechaEntrega ? new Date(item.fechaEntrega) : null,
        cantidadSolicitada: parseFloat(item.cantidadSolicitada) || 0,
        precioObjetivo: item.precioObjetivo
          ? parseFloat(item.precioObjetivo)
          : null,
        moneda: item.moneda || "MXN",
      })),
    });
  }

  // Modo Manual también necesita el registro en LicitacionProveedor: es la
  // lista de invitados que lee captura-manual, aunque no se les notifique.
  if (datos.proveedoresInvitados.length > 0) {
    await prisma.licitacionProveedor.createMany({
      data: datos.proveedoresInvitados.map((proveedorId) => ({
        licitacionId: licitacion.id,
        proveedorId,
      })),
    });
  }

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  const destino = esManualEnProceso
    ? `${basePath}/comprador/licitaciones-proceso`
    : `${basePath}/comprador/licitaciones/lanzamiento`;

  // Nueva creación: nunca hubo notificación previa ni fecha anterior.
  return {
    destino,
    estadoPrevio: "Borrador",
    fechaAnteriorISO: null,
    fechaCambio: false,
  };
}

export async function actualizarLicitacionAction(
  id: string,
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardarLicitacion> {
  validarFechas(datos);

  // Captura el estado y la fecha ANTES del update — la fuente de verdad es
  // la BD en este momento, no lo que traiga cacheado el cliente.
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, fechaEjecucion: true },
  });

  const nuevaFechaEjecucion = parsearFechaMexico(datos.fechaEjecucion);
  const esFutura = nuevaFechaEjecucion !== null && nuevaFechaEjecucion > new Date();

  const fechaCambio =
    (anterior?.fechaEjecucion?.getTime() ?? null) !==
    (nuevaFechaEjecucion?.getTime() ?? null);
  const estadoPrevio = anterior?.estado ?? "Borrador";
  const yaNotificada = estadoPrevio === "Programada" || estadoPrevio === "En Proceso";

  console.log(
    "Fecha anterior:",
    anterior?.fechaEjecucion?.toISOString() ?? null,
    "Fecha nueva:",
    nuevaFechaEjecucion?.toISOString() ?? null,
    "Cambió:",
    fechaCambio,
    "Ya notificada:",
    yaNotificada
  );

  await prisma.licitacion.update({
    where: { id },
    data: {
      numero: datos.numero,
      jerarquia: datos.jerarquia,
      tipoLicitacion: datos.tipoLicitacion,
      costoObjetivo: datos.costoObjetivo,
      fechaEjecucion: nuevaFechaEjecucion,
      fechaFinLicitacion: parsearFechaMexico(datos.fechaFinLicitacion),
      fechaInicioRangoEntrega: datos.fechaInicioRangoEntrega
        ? new Date(datos.fechaInicioRangoEntrega)
        : null,
      fechaFinRangoEntrega: datos.fechaFinRangoEntrega
        ? new Date(datos.fechaFinRangoEntrega)
        : null,
      duracionRondaMinutos: datos.duracionRondaMinutos,
      maxRondas: datos.maxRondas,
      instrucciones: datos.instrucciones,
      archivosAdjuntos:
        datos.archivosAdjuntos.length > 0 ? JSON.stringify(datos.archivosAdjuntos) : null,
      modoLicitacion: datos.modoLicitacion,
      estado: esFutura ? "Programada" : datos.estado,
      ...(esFutura ? { rondaActual: 0, inicioRondaActual: null, esperandoDecision: false } : {}),
      ...(!esFutura && datos.estado === "En Proceso" ? { fechaInicioLicitacion: new Date() } : {}),
      ...(!esFutura && datos.estado === "Cerrada" ? { fechaCerrada: new Date() } : {}),
    },
  });

  await prisma.licitacionItem.deleteMany({ where: { licitacionId: id } });
  const itemsValidos = datos.items.filter((item) => item.productoId !== "");
  if (itemsValidos.length > 0) {
    await prisma.licitacionItem.createMany({
      data: itemsValidos.map((item: any) => ({
        licitacionId: id,
        productoId: item.productoId,
        especificacion: item.especificacion || null,
        fechaEntrega: item.fechaEntrega ? new Date(item.fechaEntrega) : null,
        cantidadSolicitada: parseFloat(item.cantidadSolicitada) || 0,
        precioObjetivo: item.precioObjetivo
          ? parseFloat(item.precioObjetivo)
          : null,
        moneda: item.moneda || "MXN",
      })),
    });
  }

  await prisma.licitacionProveedor.deleteMany({ where: { licitacionId: id } });
  // Modo Manual también necesita el registro en LicitacionProveedor: es la
  // lista de invitados que lee captura-manual, aunque no se les notifique.
  if (datos.proveedoresInvitados.length > 0) {
    await prisma.licitacionProveedor.createMany({
      data: datos.proveedoresInvitados.map((proveedorId) => ({
        licitacionId: id,
        proveedorId,
      })),
    });
  }

  const estadoFinal = esFutura ? "Programada" : datos.estado;

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  let destino: string;
  if (estadoFinal === "En Proceso") {
    destino =
      datos.modoLicitacion === "Manual"
        ? `${basePath}/comprador/licitaciones-proceso/${id}/captura-manual`
        : `${basePath}/comprador/licitaciones-proceso`;
  } else if (estadoFinal === "Cerrada") {
    destino = `${basePath}/comprador/seleccion-proveedores`;
  } else {
    destino = `${basePath}/comprador/licitaciones/lanzamiento`;
  }

  return {
    destino,
    estadoPrevio,
    fechaAnteriorISO: anterior?.fechaEjecucion?.toISOString() ?? null,
    fechaCambio,
  };
}

export async function eliminarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await prisma.licitacion.update({
    where: { id },
    data: { eliminado: true, eliminadoEn: new Date() },
  });
  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}
