"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { parsearFechaMexico } from "@/src/lib/dateUtils";
import { getTiposCambioActuales } from "@/src/lib/getCatalogos";
import { registrarCambioEstado, getUsuarioIdActual } from "@/src/lib/estadoLog";
import {
  resolverEstado,
  type IntencionGuardado,
} from "@/src/lib/licitacionesIntencion";

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
  // Id de la licitación guardada. En creación es el recién asignado — el
  // cliente lo necesita para llamar a `lanzarLicitacionAction` cuando el lote
  // de invitaciones salga completo.
  licitacionId: string;
  // Estado de la licitación ANTES de este guardado. NO decide si se notifica
  // (eso lo decide la intención del botón, y aplicarlo es trabajo de
  // `lanzarLicitacionAction`): sigue aquí solo para el correo de cambio de
  // fecha, que sí depende de si la licitación ya había salido de Borrador.
  estadoPrevio: string;
  // Cuándo salió el lote completo de invitaciones, o null si no hay registro.
  // Informativo para el cliente: quién puede reenviar ya no depende de esto
  // (relanzar re-notifica siempre) y el sello es idempotente del lado del
  // servidor, en `lanzarLicitacionAction`.
  invitacionesEnviadasEn: string | null;
  // fechaEjecucion tal como estaba en la BD antes de este guardado (ISO,
  // instante real) — null si nunca tuvo fecha o es de nueva creación.
  fechaAnteriorISO: string | null;
  // true si fechaEjecucion cambió respecto al valor leído de la BD
  // (comparado ahí mismo, no contra un valor cacheado del cliente).
  fechaCambio: boolean;
};

/**
 * Resultado de guardar. Los fallos ESPERADOS se devuelven, no se lanzan: Next
 * enmascara en producción el mensaje de los errores lanzados dentro de una
 * Server Action (la guía oficial de mutating-data recomienda devolverlos en el
 * estado), así que un `throw` dejaría al comprador con un error genérico en vez
 * del motivo real.
 */
export type ResultadoGuardar =
  | ({ ok: true } & ResultadoGuardarLicitacion)
  | { ok: false; error: string };

const MENSAJE_NUMERO_DUPLICADO =
  "El número de licitación ya existe. Refresca la página e intenta de nuevo con el número que se sugiera.";

/**
 * ¿Es una violación de unicidad de Prisma (P2002) sobre el campo `numero`?
 *
 * Ocurre cuando dos compradores abren el formulario a la vez: ambos reciben la
 * misma sugerencia y el segundo en guardar choca contra la constraint @unique.
 * Se inspecciona sin importar tipos de Prisma para no arrastrar su runtime.
 */
function esNumeroDuplicado(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes("numero"));
  return target === undefined || String(target).includes("numero");
}

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
  // Qué botón se apretó. El servidor decide el estado a partir de ESTO y del
  // estado que la licitación ya tenía en la base — nunca infiriéndolo de la
  // fecha (causa del bug de invitaciones de la 0016) ni aceptándolo del
  // cliente. AQUÍ NO VA UN CAMPO `estado`: lo había, `crearLicitacionAction`
  // lo escribía verbatim, y por esa rendija se colaba la promoción silenciosa
  // a "Programada" en el camino de CREACIÓN, esquivando `resolverEstado`.
  intencion: IntencionGuardado;
  modoLicitacion: string;
  items: ItemInput[];
  proveedoresInvitados: string[];
  // Tipos de cambio congelados (respecto a MXN), ej. { USD: 17.2 }. MXN no se guarda.
  tiposCambio?: Record<string, number>;
  // Moneda de consolidación de los totales (default MXN).
  monedaConsolidacion?: string;
};

// Normaliza el mapa de tipos de cambio: descarta MXN y tasas no positivas.
// Devuelve null cuando no hay ninguna tasa válida (columna Json? = null).
function sanearTiposCambio(
  tiposCambio: Record<string, number> | undefined
): Record<string, number> | null {
  if (!tiposCambio) return null;
  const out: Record<string, number> = {};
  for (const [moneda, tasa] of Object.entries(tiposCambio)) {
    if (moneda === "MXN") continue;
    if (typeof tasa === "number" && Number.isFinite(tasa) && tasa > 0) {
      out[moneda] = tasa;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

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

/**
 * A dónde mandar al comprador según cómo quedó la licitación. Local (no
 * exportado) porque este archivo es "use server" y solo puede exportar
 * funciones async. Lo comparten `actualizarLicitacionAction` y
 * `lanzarLicitacionAction`: tras el lanzamiento el destino cambia (la
 * licitación pasó a Programada), así que el que se calculó al guardar ya no
 * sirve y hay que recalcularlo aquí.
 */
function destinoParaEstado(
  basePath: string,
  estado: string,
  modoLicitacion: string,
  id: string
): string {
  if (estado === "En Proceso") {
    return modoLicitacion === "Manual"
      ? `${basePath}/comprador/licitaciones-proceso/${id}/captura-manual`
      : `${basePath}/comprador/licitaciones-proceso`;
  }
  if (estado === "Cerrada") return `${basePath}/comprador/seleccion-proveedores`;
  return `${basePath}/comprador/licitaciones/lanzamiento`;
}

export async function crearLicitacionAction(
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardar> {
  validarFechas(datos);

  const cookieStore = await cookies();
  const rawCompradorId = cookieStore.get("cyrgo_comprador_id")?.value ?? "default";
  // "__todos__" means the user has supervisor access — attribute to "default" on create
  const compradorId = rawCompradorId === "__todos__" ? "default" : rawCompradorId;

  // Una licitación que no existe "era" un Borrador: ese es el estadoPrevio con
  // el que se entra a la máquina. Así `preparar_lanzamiento` nace en Borrador
  // (y solo `lanzarLicitacionAction` la promoverá, cuando los correos salgan),
  // e `iniciar_manual` nace En Proceso. Mismo criterio que en la edición: el
  // estado sale de UN solo lugar.
  const nuevaFechaEjecucion = parsearFechaMexico(datos.fechaEjecucion);
  const esFutura = nuevaFechaEjecucion !== null && nuevaFechaEjecucion > new Date();
  const { estado: estadoInicial } = resolverEstado("Borrador", datos.intencion, esFutura);

  const esManualEnProceso =
    datos.modoLicitacion === "Manual" && estadoInicial === "En Proceso";

  // Herencia congelada: parte de los tipos de cambio actuales de Settings y los
  // sobrescribe con lo que envió el formulario (override manual del comprador).
  // El resultado queda CONGELADO en la licitación; cambiar Settings después no
  // afecta a esta licitación.
  const tiposCambioSettings = await getTiposCambioActuales("default");
  const tiposCambioCongelado = sanearTiposCambio({
    ...tiposCambioSettings,
    ...(datos.tiposCambio ?? {}),
  });

  let licitacion;
  try {
    licitacion = await prisma.licitacion.create({
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
      tiposCambio: tiposCambioCongelado ?? undefined,
      monedaConsolidacion: datos.monedaConsolidacion || "MXN",
      estado: estadoInicial,
      modoLicitacion: datos.modoLicitacion,
      compradorId,
      clienteId: "default",
      ...(esManualEnProceso ? { rondaActual: 1, inicioRondaActual: new Date(), fechaInicioLicitacion: new Date() } : {}),
    },
    });
  } catch (error) {
    if (esNumeroDuplicado(error)) {
      return { ok: false, error: MENSAJE_NUMERO_DUPLICADO };
    }
    throw error;
  }

  // Primera entrada de la bitácora: creación (estadoAnterior null).
  await registrarCambioEstado(
    licitacion.id,
    null,
    licitacion.estado,
    await getUsuarioIdActual()
  );

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
    ok: true,
    destino,
    licitacionId: licitacion.id,
    estadoPrevio: "Borrador",
    invitacionesEnviadasEn: null,
    fechaAnteriorISO: null,
    fechaCambio: false,
  };
}

export async function actualizarLicitacionAction(
  id: string,
  basePath: string,
  datos: LicitacionInput
): Promise<ResultadoGuardar> {
  validarFechas(datos);

  // Captura el estado y la fecha ANTES del update — la fuente de verdad es
  // la BD en este momento, no lo que traiga cacheado el cliente.
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, fechaEjecucion: true, invitacionesEnviadasEn: true },
  });

  const nuevaFechaEjecucion = parsearFechaMexico(datos.fechaEjecucion);
  const esFutura = nuevaFechaEjecucion !== null && nuevaFechaEjecucion > new Date();

  const fechaCambio =
    (anterior?.fechaEjecucion?.getTime() ?? null) !==
    (nuevaFechaEjecucion?.getTime() ?? null);
  const estadoPrevio = anterior?.estado ?? "Borrador";

  // El estado sale de la intención del botón + lo que la licitación YA era,
  // resuelto en un solo lugar (licitacionesIntencion.ts). Antes se calculaba
  // aquí con `esFutura ? "Programada" : datos.estado`, y esa inferencia era
  // el bug: promovía borradores a Programada a espaldas del comprador.
  const { estado: estadoFinal, reiniciarRondas } = resolverEstado(
    estadoPrevio,
    datos.intencion,
    esFutura
  );

  // Entrar a "En Proceso" marca el inicio real de la licitación. Se sella solo
  // en la TRANSICIÓN: antes bastaba con que el estado enviado fuera "En
  // Proceso", así que cada guardado de una licitación ya arrancada le movía la
  // hora de inicio y falseaba los tiempos por etapa del Tablero.
  const entraAEnProceso = estadoFinal === "En Proceso" && estadoPrevio !== "En Proceso";
  const entraACerrada = estadoFinal === "Cerrada" && estadoPrevio !== "Cerrada";

  try {
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
      // Solo sobrescribe cuando llegan tasas válidas; si no hay ninguna (todo
      // MXN) se omite y se conserva el valor previo (tasas sin uso son inocuas).
      ...(sanearTiposCambio(datos.tiposCambio)
        ? { tiposCambio: sanearTiposCambio(datos.tiposCambio)! }
        : {}),
      ...(datos.monedaConsolidacion
        ? { monedaConsolidacion: datos.monedaConsolidacion }
        : {}),
      modoLicitacion: datos.modoLicitacion,
      estado: estadoFinal,
      ...(reiniciarRondas
        ? { rondaActual: 0, inicioRondaActual: null, esperandoDecision: false }
        : {}),
      ...(entraAEnProceso ? { fechaInicioLicitacion: new Date() } : {}),
      ...(entraACerrada ? { fechaCerrada: new Date() } : {}),
    },
    });
  } catch (error) {
    if (esNumeroDuplicado(error)) {
      return { ok: false, error: MENSAJE_NUMERO_DUPLICADO };
    }
    throw error;
  }

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

  // Registra el cambio de estado si lo hubo (el helper ignora anterior===nuevo).
  await registrarCambioEstado(
    id,
    estadoPrevio,
    estadoFinal,
    await getUsuarioIdActual()
  );

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  const destino = destinoParaEstado(basePath, estadoFinal, datos.modoLicitacion, id);

  return {
    ok: true,
    destino,
    licitacionId: id,
    estadoPrevio,
    // Se devuelve el valor LEÍDO ANTES del update. Este action nunca lo
    // escribe: sellarlo es trabajo de `lanzarLicitacionAction`, que corre
    // cuando los correos de verdad salieron.
    invitacionesEnviadasEn: anterior?.invitacionesEnviadasEn?.toISOString() ?? null,
    fechaAnteriorISO: anterior?.fechaEjecucion?.toISOString() ?? null,
    fechaCambio,
  };
}

/**
 * Resultado de aplicar el lanzamiento. Como en el guardado, los fallos
 * ESPERADOS se devuelven en vez de lanzarse: Next enmascara en producción el
 * mensaje de un error lanzado dentro de una Server Action, y aquí el mensaje
 * importa muchísimo — los correos YA SALIERON y el comprador tiene que
 * entender que lo único pendiente es reintentar el lanzamiento.
 */
export type ResultadoLanzar =
  | {
      ok: true;
      /** A dónde navegar, recalculado DESPUÉS de la promoción. */
      destino: string;
      /** Estado con el que quedó la licitación. */
      estado: string;
      /** true si esta llamada fue la que movió Borrador → Programada. */
      promovida: boolean;
    }
  | { ok: false; error: string };

const ERROR_LANZAMIENTO =
  "Los correos de invitación SÍ se enviaron, pero no se pudo aplicar el " +
  "lanzamiento de la licitación. Vuelve a intentarlo — no se reenviarán los " +
  "correos.";

/**
 * Aplica el lanzamiento: "los correos salieron, ahora sí muévela".
 *
 * ── Por qué existe (y por qué el guardado ya no promueve) ───────────────────
 * Cambiar el estado y notificar a los proveedores tienen que ser ATÓMICOS.
 * Antes no lo eran: `actualizarLicitacionAction` escribía "Programada" y
 * RECIÉN DESPUÉS el cliente abría el modal de correo. Si el comprador le daba
 * cancelar, la licitación quedaba lanzada sin que nadie hubiera sido invitado
 * — y si la fecha ya había pasado, la siguiente carga de página la arrancaba
 * sola (`verificarYActualizarEstado`), con ronda 1 y aviso publicado, para
 * proveedores que nunca recibieron la invitación.
 *
 * Ahora el guardado deja la licitación como estaba (ver `resolverEstado`,
 * intención "preparar_lanzamiento") y TODO el lanzamiento ocurre aquí, en una
 * transacción, disparado por el `onEnviado` del modal — que ModalCorreo solo
 * llama si el lote COMPLETO de correos salió bien. Cancelar el modal no llega
 * nunca a esta función, así que cancelar no cambia nada: es el no-op que
 * debía ser desde el principio.
 *
 * ── Qué hace exactamente ────────────────────────────────────────────────────
 * 1. Promueve, y SOLO desde "Borrador". Un relanzamiento (editar algo ya
 *    Programada o En Proceso y volver a notificar) reenvía los correos pero NO
 *    toca el estado: la licitación ya está donde debe.
 * 2. Sella `invitacionesEnviadasEn` solo si estaba en null, así que un
 *    relanzamiento conserva la fecha del envío original en vez de pisarla.
 * 3. Registra la transición en bitácora, solo si de verdad hubo movimiento.
 *
 * Los tres pasos van en UNA transacción. Es deliberado que la bitácora entre
 * aquí y no por `registrarCambioEstado` (que es best-effort con el cliente
 * global): esa bitácora alimenta los tiempos por etapa del Tablero, y un
 * lanzamiento sin su entrada correspondiente es justo el tipo de agujero que
 * falsea los KPIs. Si falla el log, se cae todo y el comprador reintenta.
 *
 * Idempotente: reintentarlo tras un fallo de red no duplica nada. La promoción
 * es un compare-and-set (`where: { estado: "Borrador" }`) y el sello exige
 * `invitacionesEnviadasEn: null`, así que la segunda pasada encuentra el
 * trabajo hecho y devuelve `promovida: false` sin escribir. Eso es lo que
 * permite ofrecer un botón "Reintentar" sin reenviar correos.
 */
export async function lanzarLicitacionAction(
  id: string,
  basePath: string
): Promise<ResultadoLanzar> {
  const usuarioId = await getUsuarioIdActual();

  // La lectura va FUERA de la transacción a propósito. No es la que garantiza
  // la corrección — de eso se encarga el compare-and-set de abajo, que lleva el
  // estado en el WHERE — y meterla dentro solo alargaba la transacción. Con la
  // base en Supabase (remota) cada ida y vuelta cuesta ~2 s, y las cuatro
  // sentencias juntas se pasaban del timeout de 5 s que Prisma aplica por
  // defecto a las transacciones interactivas: el lanzamiento fallaba con P2028
  // DESPUÉS de que los correos ya habían salido. Observado en pruebas: 7181 ms.
  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, modoLicitacion: true },
  });
  if (!lic) return { ok: false, error: "La licitación ya no existe." };

  let resultado: { estado: string; promovida: boolean; modoLicitacion: string };
  try {
    resultado = await prisma.$transaction(
      async (tx) => {
        // 1) Promoción. Compare-and-set: el estado va en el WHERE, así que dos
        //    pestañas enviando a la vez no promueven dos veces (solo una
        //    obtiene count === 1) y no se duplica la entrada de bitácora. Por
        //    eso da igual que `lic.estado` se haya leído fuera: si cambió
        //    entretanto, el UPDATE no encuentra fila y no se promueve.
        let promovida = false;
        if (lic.estado === "Borrador") {
          const r = await tx.licitacion.updateMany({
            where: { id, estado: "Borrador" },
            data: { estado: "Programada" },
          });
          promovida = r.count === 1;
        }

        // 2) Sello del envío. Solo la primera vez (ver el `where`): un
        //    relanzamiento no pisa la fecha del envío original.
        await tx.licitacion.updateMany({
          where: { id, invitacionesEnviadasEn: null },
          data: { invitacionesEnviadasEn: new Date() },
        });

        // 3) Bitácora, en la misma transacción que la promoción.
        if (promovida) {
          await tx.licitacionEstadoLog.create({
            data: {
              licitacionId: id,
              estadoAnterior: "Borrador",
              estadoNuevo: "Programada",
              usuarioId: usuarioId ?? null,
            },
          });
        }

        return {
          estado: promovida ? "Programada" : lic.estado,
          promovida,
          modoLicitacion: lic.modoLicitacion,
        };
      },
      // Margen amplio sobre el default de 5 s: son hasta 3 sentencias contra
      // una base remota. Este bloque no debe fallar por reloj — cuando falla,
      // los correos ya salieron y la licitación queda a medio lanzar.
      { timeout: 20000, maxWait: 10000 }
    );
  } catch (error) {
    console.error("[lanzarLicitacion] no se pudo aplicar el lanzamiento", { id }, error);
    return { ok: false, error: ERROR_LANZAMIENTO };
  }

  revalidatePath(`${basePath}/comprador/licitaciones`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);

  return {
    ok: true,
    destino: destinoParaEstado(basePath, resultado.estado, resultado.modoLicitacion, id),
    estado: resultado.estado,
    promovida: resultado.promovida,
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
