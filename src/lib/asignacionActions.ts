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
 * Revalidación DIFERIDA de las rutas de Selección.
 *
 * Por qué existe: `revalidatePath` dentro de una server action no solo invalida
 * caché — Next.js manda de vuelta el RSC actualizado y el cliente lo aplica de
 * inmediato. En este módulo eso es destructivo: al crear las asignaciones, el
 * server component (`seleccion-proveedores/[id]/page.tsx`) deja de renderizar
 * <AsignacionForm> y pasa a <SeguimientoView>. Ese cambio DESMONTA
 * AsignacionForm y se lleva su estado `colaCorreos` — el modal de correo
 * parpadea y desaparece antes de que el comprador pueda enviarlo.
 *
 * Por eso `confirmarAsignacionesAction` y `finalizarSinEsperarAction` NO
 * revalidan: el cliente llama esta acción al vaciar la cola de correos, cuando
 * ya es seguro remontar.
 */
export async function revalidarSeleccionAction(
  licitacionId: string,
  basePath: string
): Promise<void> {
  revalidar(basePath, licitacionId);
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
 *
 * Sin `basePath`: ya no revalida (ver revalidarSeleccionAction).
 */
export async function confirmarAsignacionesAction(
  licitacionId: string,
  filas: FilaAsignacion[],
  tiempoConfirmacionHoras: number
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

  // Sin revalidar: al existir ya asignaciones, revalidar aquí cambiaría la vista
  // a SeguimientoView y desmontaría el modal del correo tentativo que el cliente
  // está por abrir. Lo hace el cliente con revalidarSeleccionAction al cerrarlo.
}

/**
 * Vía express: finaliza sin pedir validación a los proveedores (asignaciones
 * directo en "Aprobado"). Sin `basePath`: ya no revalida — el cliente abre la
 * cola de 3 correos y llama revalidarSeleccionAction al vaciarla.
 */
export async function finalizarSinEsperarAction(
  licitacionId: string,
  filas: FilaAsignacion[]
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

  // Sin revalidar, por la misma razón que confirmarAsignacionesAction: aquí
  // también nacen las asignaciones y la vista saltaría a SeguimientoView,
  // matando la cola de 3 correos recién abierta.
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
 * Ajusta cantidad y fecha estimada de una asignación MIENTRAS el proveedor no
 * la haya validado. El comprador tiene la última palabra: la edición es final y
 * el proveedor validará sobre el valor editado.
 *
 * El candado vive en el `where`, no en la UI. Con `updateMany` filtrando por
 * `estatusProveedor: "Pendiente"`, si el proveedor valida entre que se pintó la
 * pantalla y que el comprador guarda, el update NO aplica y `count` vuelve 0 —
 * el cliente avisa y recarga. Un `update` por id pisaría una asignación ya
 * aprobada (que además ya tiene orden de compra emitida).
 *
 * Deliberadamente NO toca `estatusProveedor`, `fechaLimiteConfirmacion`,
 * `fechaConfirmacion` ni `motivoRechazo`: editar no re-dispara la validación ni
 * reinicia el plazo que ya está corriendo.
 */
export async function editarAsignacionPendienteAction(
  asignacionId: string,
  cantidadAsignada: number,
  fechaEstimadaProveedor: string | null,
  licitacionId: string,
  basePath: string
): Promise<{ actualizada: boolean }> {
  const { count } = await prisma.asignacionMaterial.updateMany({
    where: { id: asignacionId, estatusProveedor: "Pendiente" },
    data: {
      cantidadAsignada,
      fechaEstimadaProveedor: fechaEstimadaProveedor
        ? new Date(fechaEstimadaProveedor)
        : null,
    },
  });

  if (count === 0) return { actualizada: false };

  // Revalidación normal: esta acción no crea asignaciones, así que la vista
  // sigue siendo SeguimientoView y no hay cola de correos abierta que tumbar
  // (a diferencia de confirmar/finalizar, ver revalidarSeleccionAction).
  revalidar(basePath, licitacionId);
  return { actualizada: true };
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
