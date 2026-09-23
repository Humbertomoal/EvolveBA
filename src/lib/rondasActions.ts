"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import {
  registrarCambioEstado,
  getUsuarioIdActual,
  ESTADO_ESPERANDO_DECISION,
} from "@/src/lib/estadoLog";
import { exigirCompradorSesion } from "@/src/lib/compradorSessionSegura";
import { EMISOR_SISTEMA, publicarAvisoRonda } from "@/src/lib/avisosRonda";
import type {
  ResultadoCierreRondas,
  ResultadoAvisoFinalizacion,
} from "@/src/lib/rondasTypes";

// NOTA: los tipos de resultado viven en rondasTypes.ts. Este archivo es
// "use server" y NO debe exportar nada que no sea una función async — ni
// siquiera tipos (ver el comentario de rondasTypes.ts).

/**
 * Cierra DE GOLPE todas las rondas restantes y salta al estado final.
 *
 * Destino: el pseudo-estado "Esperando Decisión" — `esperandoDecision = true`
 * sobre `estado = "En Proceso"`, que es exactamente donde queda una licitación
 * que agota sus rondas por tiempo. NO va a "Esperando Validación": ese estado
 * es posterior y lo escribe asignacionActions al mandar la asignación
 * preliminar; saltar ahí se brincaría la decisión del comprador, que es
 * justamente el paso que este botón habilita.
 *
 * `inicioRondaActual` NO se toca, y es deliberado aunque parezca al revés:
 * ponerlo en `now` haría que la rama (b) de `rondaAceptable` (ofertasActions)
 * aceptara ofertas para la penúltima ronda durante los 3 minutos de gracia
 * SIGUIENTES al cierre. Dejándolo intacto, la gracia se mide desde que empezó
 * la ronda que estaba en curso y la ventana queda cerrada.
 */
export async function cerrarTodasLasRondasAction(
  id: string,
  basePath: string
): Promise<ResultadoCierreRondas> {
  const { usuarioId } = await exigirCompradorSesion();

  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      estado: true,
      esperandoDecision: true,
      modoLicitacion: true,
      rondaActual: true,
      maxRondas: true,
    },
  });

  if (!lic) {
    return { ok: false, motivo: "no_encontrada", mensaje: "La licitación no existe." };
  }
  if (lic.modoLicitacion === "Manual") {
    return {
      ok: false,
      motivo: "modo_manual",
      mensaje: "Las licitaciones de captura manual no manejan rondas.",
    };
  }
  if (lic.estado !== "En Proceso") {
    return {
      ok: false,
      motivo: "estado_invalido",
      mensaje: `La licitación está en "${lic.estado}" y ya no admite cierre de rondas.`,
    };
  }
  if (lic.esperandoDecision) {
    return {
      ok: false,
      motivo: "ya_cerrada",
      mensaje: "Las rondas ya están cerradas; la licitación espera tu decisión.",
    };
  }
  if (lic.rondaActual < 1) {
    return {
      ok: false,
      motivo: "sin_iniciar",
      mensaje: "La licitación aún no arranca su primera ronda.",
    };
  }

  const now = new Date();

  // Compare-and-set: el estado leído va en el WHERE, así que Postgres resuelve
  // esto como un solo UPDATE condicional. Si otro clic —o el avance automático
  // que dispara cualquier carga de página— ganó la carrera, el WHERE no casa y
  // count === 0. Sin esto, dos ejecuciones dejarían DOS entradas
  // "En Proceso → Esperando Decisión" en la bitácora, que es de donde el
  // Tablero saca los tiempos por etapa.
  const resultado = await prisma.licitacion.updateMany({
    where: {
      id,
      estado: "En Proceso",
      esperandoDecision: false,
      rondaActual: lic.rondaActual,
      maxRondas: lic.maxRondas,
    },
    data: {
      rondaActual: lic.maxRondas,
      esperandoDecision: true,
      fechaFinReal: now,
      fechaEsperandoDecision: now,
    },
  });

  if (resultado.count === 0) {
    return {
      ok: false,
      motivo: "ya_cerrada",
      mensaje: "Otro usuario (o el avance automático) cerró las rondas primero.",
    };
  }

  // Solo se registra si ESTA llamada fue la que escribió.
  await registrarCambioEstado(id, "En Proceso", ESTADO_ESPERANDO_DECISION, usuarioId);
  // El aviso lleva la ronda en la que se estaba, no maxRondas: para el proveedor
  // la ronda que "concluyó" es la que él vio abierta, no las que se omitieron.
  await publicarAvisoRonda(id, { tipo: "cierre", ultimaRonda: lic.rondaActual });

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso/${id}`);

  return { ok: true, rondasOmitidas: lic.maxRondas - lic.rondaActual };
}

// Fuerza el fin de la ronda actual:
// - Si es ronda intermedia: avanza a la siguiente
// - Si es la última ronda: activa esperandoDecision
export async function forzarAvanceRondaAction(
  id: string,
  basePath: string
): Promise<void> {
  await exigirCompradorSesion();

  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { rondaActual: true, maxRondas: true },
  });
  if (!lic) return;

  const now = new Date();
  // Compare-and-set: el estado leído va en el WHERE. Antes era un `update`
  // directo, así que dos clics —o un clic contra el avance perezoso que dispara
  // cualquier carga de página— podían aplicar el salto dos veces. Ahora solo
  // gana uno, y el aviso al proveedor cuelga de esa escritura ganadora.
  const guardaComun = {
    id,
    estado: "En Proceso",
    esperandoDecision: false,
    rondaActual: lic.rondaActual,
    maxRondas: lic.maxRondas,
  };

  if (lic.rondaActual < lic.maxRondas) {
    // Solo avanza de ronda: el estado sigue "En Proceso" (no se registra).
    const avance = await prisma.licitacion.updateMany({
      where: guardaComun,
      data: { rondaActual: lic.rondaActual + 1, inicioRondaActual: now },
    });
    if (avance.count === 1) {
      await publicarAvisoRonda(id, {
        tipo: "nueva_ronda",
        ronda: lic.rondaActual + 1,
      });
    }
  } else {
    const cierre = await prisma.licitacion.updateMany({
      where: guardaComun,
      data: { esperandoDecision: true, fechaFinReal: now, fechaEsperandoDecision: now },
    });
    if (cierre.count === 1) {
      await registrarCambioEstado(
        id,
        "En Proceso",
        ESTADO_ESPERANDO_DECISION,
        await getUsuarioIdActual()
      );
      await publicarAvisoRonda(id, { tipo: "cierre", ultimaRonda: lic.rondaActual });
    }
  }

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso/${id}`);
}

// Agrega una ronda extra: incrementa rondaActual y maxRondas en 1,
// reinicia inicioRondaActual y limpia esperandoDecision.
// Se incrementa maxRondas (no solo rondaActual) para que la lógica de
// verificarYActualizarEstado siga funcionando correctamente:
// cuando esta ronda extra termine, rondaActual == maxRondas → esperandoDecision=true.
export async function agregarRondaExtraAction(
  id: string,
  basePath: string
): Promise<void> {
  await exigirCompradorSesion();

  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { rondaActual: true, maxRondas: true, esperandoDecision: true },
  });
  if (!lic) return;

  // Compare-and-set. OJO: `esperandoDecision` va en el WHERE con el valor
  // LEÍDO, no con `false` — esta acción corre tanto sobre una licitación en
  // curso como sobre una que ya está en "Esperando Decisión" (ahí es donde
  // reabre las rondas). Fijarlo a false rompería justo el caso principal.
  const extra = await prisma.licitacion.updateMany({
    where: {
      id,
      estado: "En Proceso",
      rondaActual: lic.rondaActual,
      maxRondas: lic.maxRondas,
      esperandoDecision: lic.esperandoDecision,
    },
    data: {
      rondaActual: lic.rondaActual + 1,
      maxRondas: lic.maxRondas + 1,
      inicioRondaActual: new Date(),
      esperandoDecision: false,
    },
  });

  if (extra.count === 1) {
    // Reabre las rondas: si venía de "Esperando Decisión", vuelve a "En Proceso".
    if (lic.esperandoDecision) {
      await registrarCambioEstado(
        id,
        ESTADO_ESPERANDO_DECISION,
        "En Proceso",
        await getUsuarioIdActual()
      );
    }
    await publicarAvisoRonda(id, {
      tipo: "nueva_ronda",
      ronda: lic.rondaActual + 1,
    });
  }

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/licitaciones-proceso/${id}`);
}

/**
 * Manda a los proveedores el aviso de que la licitación finalizó. Y NADA más.
 *
 * No toca el estado, no pasa a selección, no cierra rondas: es el botón
 * "Finalizar licitación" del detalle, cuyo único efecto es comunicar. El
 * paso a selección sigue siendo `cerrarLicitacionAction`, independiente.
 *
 * Existe porque el aviso dejó de mandarse solo al agotar las rondas (ver
 * licitacionesLogica.ts): ahora el final lo anuncia el comprador cuando ya
 * decidió que no habrá más rondas.
 *
 * `ultimaRonda` es la ronda en la que está la licitación, que es la última
 * que el proveedor vio abierta — mismo criterio que el resto de los cierres.
 */
export async function enviarAvisoFinalizacionAction(
  id: string,
  basePath: string
): Promise<ResultadoAvisoFinalizacion> {
  await exigirCompradorSesion();

  const lic = await prisma.licitacion.findUnique({
    where: { id },
    select: { rondaActual: true },
  });
  if (!lic) {
    return {
      ok: false,
      motivo: "no_encontrada",
      mensaje: "La licitación ya no existe.",
    };
  }

  // Guarda de idempotencia: el aviso de finalización se manda UNA vez. Sin
  // esto, dos clics —o dos compradores a la vez— publicarían el mismo
  // anuncio dos veces en el chat de cada proveedor, que es justo el ruido
  // que este cambio vino a quitar.
  //
  // Se detecta por el texto y no por una columna nueva: `cierre()` en
  // plantillasChat.ts siempre contiene esta frase, y el aviso ya vive en
  // ChatMensaje. Una bandera en Licitacion sería una columna para un dato
  // que ya está guardado.
  const yaEnviado = await prisma.chatMensaje.count({
    where: {
      licitacionId: id,
      emisor: EMISOR_SISTEMA,
      mensaje: { contains: "Hemos llegado a los mejores precios" },
    },
  });
  if (yaEnviado > 0) {
    return {
      ok: false,
      motivo: "ya_enviado",
      mensaje:
        "Los proveedores ya recibieron el aviso de finalización de esta licitación.",
    };
  }

  await publicarAvisoRonda(id, {
    tipo: "cierre",
    ultimaRonda: lic.rondaActual,
  });

  revalidatePath(`${basePath}/comprador/licitaciones-proceso/${id}`);
  return { ok: true };
}

export async function cerrarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await exigirCompradorSesion();

  // Lee el estado previo para encadenar bien la bitácora (En Proceso o el
  // pseudo-estado "Esperando Decisión" según el flag).
  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, esperandoDecision: true },
  });

  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cerrada", esperandoDecision: false, fechaCerrada: new Date() },
  });

  const estadoAnterior = anterior?.esperandoDecision
    ? ESTADO_ESPERANDO_DECISION
    : anterior?.estado ?? null;
  await registrarCambioEstado(id, estadoAnterior, "Cerrada", await getUsuarioIdActual());

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
}

export async function cancelarLicitacionAction(
  id: string,
  basePath: string
): Promise<void> {
  await exigirCompradorSesion();

  const anterior = await prisma.licitacion.findUnique({
    where: { id },
    select: { estado: true, esperandoDecision: true },
  });

  await prisma.licitacion.update({
    where: { id },
    data: { estado: "Cancelada", esperandoDecision: false, fechaCancelada: new Date() },
  });

  const estadoAnterior = anterior?.esperandoDecision
    ? ESTADO_ESPERANDO_DECISION
    : anterior?.estado ?? null;
  await registrarCambioEstado(id, estadoAnterior, "Cancelada", await getUsuarioIdActual());

  revalidatePath(`${basePath}/comprador/licitaciones-proceso`);
  revalidatePath(`${basePath}/comprador/seleccion-proveedores`);
}
