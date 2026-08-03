"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { crearOrdenesCompraParaLicitacion } from "./ordenesUtils";
import { registrarCambioEstado, getUsuarioIdActual } from "./estadoLog";
import { ESTADO_ESPERANDO_VALIDACION } from "./seleccionTypes";

export type FilaAsignacion = {
  licitacionItemId: string;
  proveedorId: string;
  cantidadAsignada: number;
  precioUnitario: number;
  moneda: string;
  ronda: number;
  orden: number;
  fechaObjetivo: string | null;
  fechaEstimadaProveedor: string | null;
};

function revalidar(basePath: string, licitacionId: string) {
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores/${licitacionId}`);
}

/**
 * MOMENTO 1 del flujo de cierre: el comprador confirma a quién le asigna cada
 * material y se lo manda a validar a los proveedores.
 *
 * Deja las asignaciones en "Pendiente" con su fecha límite y la licitación en
 * "Esperando Validación" — NO en "Finalizada": finalizar es el MOMENTO 3
 * (finalizarLicitacionAction), una vez que los proveedores validaron.
 *
 * No manda correos: el correo NOTIFICACION_GANADOR_TENTATIVO lo dispara el
 * cliente (AsignacionForm) al volver de aquí, con el modal de revisión.
 */
export async function confirmarAsignacionesAction(
  licitacionId: string,
  filas: FilaAsignacion[],
  tiempoConfirmacionHoras: number,
  basePath: string
): Promise<void> {
  const fechaLimiteConfirmacion = new Date(
    Date.now() + tiempoConfirmacionHoras * 60 * 60 * 1000
  );

  const anterior = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { estado: true },
  });

  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).asignacionMaterial.createMany({
      data: filas.map((f) => ({
        licitacionId,
        licitacionItemId: f.licitacionItemId,
        proveedorId: f.proveedorId,
        cantidadAsignada: f.cantidadAsignada,
        precioUnitario: f.precioUnitario,
        moneda: f.moneda,
        ronda: f.ronda,
        orden: f.orden,
        estatusProveedor: "Pendiente",
        fechaObjetivo: f.fechaObjetivo ? new Date(f.fechaObjetivo) : null,
        fechaEstimadaProveedor: f.fechaEstimadaProveedor
          ? new Date(f.fechaEstimadaProveedor)
          : null,
        fechaLimiteConfirmacion,
      })),
    }),
    prisma.licitacion.update({
      where: { id: licitacionId },
      // fechaFinalizada NO se toca aquí: la licitación aún no está finalizada.
      // Se sella en finalizarLicitacionAction (MOMENTO 3).
      data: { estado: ESTADO_ESPERANDO_VALIDACION },
    }),
  ]);

  // Best-effort tras la transacción principal (no la tumba si falla el log).
  await registrarCambioEstado(
    licitacionId,
    anterior?.estado ?? null,
    ESTADO_ESPERANDO_VALIDACION,
    await getUsuarioIdActual()
  );

  // OC no se crea aquí: estatus sigue "Pendiente". Se crea cuando cada proveedor
  // confirma, al dar por validadas las pendientes, o al finalizar.

  revalidar(basePath, licitacionId);
}

export async function finalizarSinEsperarAction(
  licitacionId: string,
  filas: FilaAsignacion[],
  basePath: string
): Promise<void> {
  const anterior = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { estado: true },
  });

  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).asignacionMaterial.createMany({
      data: filas.map((f) => ({
        licitacionId,
        licitacionItemId: f.licitacionItemId,
        proveedorId: f.proveedorId,
        cantidadAsignada: f.cantidadAsignada,
        precioUnitario: f.precioUnitario,
        moneda: f.moneda,
        ronda: f.ronda,
        orden: f.orden,
        estatusProveedor: "Aprobado",
        fechaObjetivo: f.fechaObjetivo ? new Date(f.fechaObjetivo) : null,
        fechaEstimadaProveedor: f.fechaEstimadaProveedor
          ? new Date(f.fechaEstimadaProveedor)
          : null,
        fechaLimiteConfirmacion: null,
      })),
    }),
    prisma.licitacion.update({
      where: { id: licitacionId },
      data: { estado: "Finalizada", fechaFinalizada: new Date() },
    }),
  ]);

  await registrarCambioEstado(
    licitacionId,
    anterior?.estado ?? null,
    "Finalizada",
    await getUsuarioIdActual()
  );

  await crearOrdenesCompraParaLicitacion(licitacionId);

  revalidar(basePath, licitacionId);
}

export async function reasignarProveedorAction(
  asignacionId: string,
  proveedorId: string,
  precioUnitario: number,
  ronda: number,
  fechaEstimadaProveedor: string | null,
  tiempoConfirmacionHoras: number,
  licitacionId: string,
  basePath: string
): Promise<void> {
  const fechaLimiteConfirmacion = new Date(
    Date.now() + tiempoConfirmacionHoras * 60 * 60 * 1000
  );

  await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      proveedorId,
      precioUnitario,
      ronda,
      fechaEstimadaProveedor: fechaEstimadaProveedor
        ? new Date(fechaEstimadaProveedor)
        : null,
      estatusProveedor: "Pendiente",
      fechaLimiteConfirmacion,
      fechaConfirmacion: null,
      motivoRechazo: null,
    },
  });

  revalidar(basePath, licitacionId);
}

/**
 * "Dar por validadas las pendientes": atajo DENTRO de la etapa de validación
 * para cuando un proveedor no responde en su plazo. Pasa las asignaciones
 * Pendiente → Aprobado y crea las OC que falten.
 *
 * NO cambia el estado de la licitación (sigue en "Esperando Validación") y NO
 * manda correos: al dejar todo aprobado aparece el botón "Finalizar licitación",
 * que es el único que finaliza y el único que dispara los correos finales. Si
 * esta acción también los mandara, ese camino los enviaría por duplicado.
 */
export async function forzarCierreSeleccionAction(
  licitacionId: string,
  basePath: string
): Promise<void> {
  await prisma.asignacionMaterial.updateMany({
    where: { licitacionId, estatusProveedor: "Pendiente" },
    data: { estatusProveedor: "Aprobado" },
  });

  await crearOrdenesCompraParaLicitacion(licitacionId);

  revalidar(basePath, licitacionId);
}

/**
 * MOMENTO 3: cierre definitivo. Sella la licitación como "Finalizada" una vez
 * que todas las asignaciones quedaron confirmadas o aprobadas.
 *
 * Crea las OC faltantes por si acaso (crearOrdenesCompraParaLicitacion es
 * idempotente: salta los pares licitación+proveedor que ya tienen OC) — lo
 * normal es que ya existan, creadas conforme cada proveedor fue confirmando.
 *
 * No manda correos: la cola de 3 (RESULTADO_INTERNO → GANADORES →
 * NO_GANADORES) la dispara el cliente (SeguimientoView) al volver de aquí.
 */
export async function finalizarLicitacionAction(
  licitacionId: string,
  basePath: string
): Promise<void> {
  const anterior = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { estado: true },
  });

  await prisma.licitacion.update({
    where: { id: licitacionId },
    data: { estado: "Finalizada", fechaFinalizada: new Date() },
  });

  await registrarCambioEstado(
    licitacionId,
    anterior?.estado ?? null,
    "Finalizada",
    await getUsuarioIdActual()
  );

  await crearOrdenesCompraParaLicitacion(licitacionId);

  revalidar(basePath, licitacionId);
}
