"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { exigirProveedorSesion } from "@/src/lib/proveedorSessionSegura";
import { esCapturaValida } from "@/src/lib/ofertaValida";

type OfertaItemInput = {
  licitacionItemId: string;
  precioUnitario: number;
  cantidadDisponible: number;
  puedeCumplirFecha: boolean;
  fechaEstimadaEntrega: string | null;
  /** true = "no dispongo de esta partida". Ver ofertaValida.ts. */
  noDisponible: boolean;
};

export type MotivoRechazoOferta =
  | "fuera_de_tiempo"
  | "no_invitado"
  | "materiales_invalidos"
  | "licitacion_no_disponible"
  | "precio_invalido";

export type ResultadoOferta =
  | { ok: true }
  | { ok: false; motivo: MotivoRechazoOferta; mensaje: string };

/**
 * Margen para aceptar ofertas después del cierre formal de la ronda.
 *
 * El auto-envío del proveedor NO ocurre al vencer el reloj: al llegar a 0 el
 * cliente abre un "tiempo extra" de 60 s y recién entonces envía
 * (LicitacionCotizacion.tsx:207-239). Así que un envío legítimo llega ~60 s
 * tarde por diseño.
 *
 * Se usan 3 minutos y no 90 s porque los navegadores estrangulan setInterval en
 * pestañas de segundo plano (hasta ~1 tick/minuto), y esa cuenta de 60 s puede
 * estirarse bastante. Tres minutos cubren ese caso y siguen siendo
 * irrelevantes frente al abuso real que esto cierra: mover precios durante las
 * HORAS que el comprador tarda en decidir.
 */
const GRACIA_MS = 3 * 60 * 1000;

type EstadoRonda = {
  rondaActual: number;
  inicioRondaActual: Date | null;
  duracionRondaMinutos: number;
  esperandoDecision: boolean;
};

/**
 * ¿La ronda para la que el proveedor cotiza sigue siendo aceptable?
 *
 * `ronda` viene del cliente A PROPÓSITO: es lo único que el servidor no puede
 * reconstruir, porque en cuanto verificarYActualizarEstado() avanza la
 * licitación se pierde el rastro de para qué ronda se estaba cotizando. No es
 * un dato de confianza —se valida contra la línea de tiempo real—, y no
 * reabre la suplantación: la identidad sigue saliendo de la sesión.
 *
 * OJO: la condición es TEMPORAL, no basada en `esperandoDecision`. Ese flag lo
 * escribe verificarYActualizarEstado(), que solo corre cuando alguien carga una
 * página (no hay cron), así que puede activarse minutos u horas después del
 * vencimiento real. La verdad autoritativa es inicioRondaActual + duración.
 */
function rondaAceptable(ronda: number, lic: EstadoRonda, ahoraMs: number): boolean {
  // Licitaciones pre-migración sin inicioRondaActual: no hay línea de tiempo
  // que verificar, así que se cae al flag como guarda más débil.
  if (!lic.inicioRondaActual) {
    return ronda === lic.rondaActual && !lic.esperandoDecision;
  }

  const inicioMs = lic.inicioRondaActual.getTime();
  const rondaFinMs = inicioMs + lic.duracionRondaMinutos * 60 * 1000;

  // (a) Ronda en curso, o recién cerrada dentro de la gracia. Cubre el
  //     auto-envío de la última ronda (la que entra a Esperando Decisión) y el
  //     de cualquier ronda cuyo avance todavía no ejecutó nadie.
  if (ronda === lic.rondaActual && ahoraMs <= rondaFinMs + GRACIA_MS) return true;

  // (b) La ronda anterior cerró y rondaActual YA avanzó. inicioRondaActual se
  //     reinició en ese avance, así que (ahora − inicio) es exactamente cuánto
  //     hace que cerró la ronda por la que llega este envío.
  if (ronda === lic.rondaActual - 1 && ahoraMs <= inicioMs + GRACIA_MS) return true;

  return false;
}

/**
 * Registra la oferta del proveedor autenticado para la ronda indicada.
 *
 * ── Identidad ──────────────────────────────────────────────────────────────
 * `proveedorId` NO viaja en la firma: sale de la sesión (JWT firmado). Antes lo
 * mandaba el cliente y cualquiera podía cotizar en nombre de un competidor.
 *
 * ── Pertenencia ────────────────────────────────────────────────────────────
 *   1. La licitación existe, no está eliminada y no es de captura Manual.
 *   2. El proveedor está INVITADO.
 *   3. Todos los licitacionItemId pertenecen a ESA licitación.
 *   4. La ronda pedida es aceptable según la línea de tiempo (ver arriba).
 *
 * Devuelve un resultado en vez de lanzar para los rechazos ESPERADOS, de modo
 * que el proveedor vea por qué no se registró su oferta. Lanzar queda reservado
 * a la falta de sesión, que indica manipulación y no uso normal.
 */
export async function enviarOfertaAction(
  licitacionId: string,
  ronda: number,
  basePath: string,
  items: OfertaItemInput[]
): Promise<ResultadoOferta> {
  const { proveedorId } = await exigirProveedorSesion();

  if (!Number.isInteger(ronda) || ronda < 1) {
    return {
      ok: false,
      motivo: "fuera_de_tiempo",
      mensaje: "La ronda indicada no es válida.",
    };
  }

  const licitacion = await prisma.licitacion.findFirst({
    where: { id: licitacionId, eliminado: false, modoLicitacion: { not: "Manual" } },
    select: {
      id: true,
      estado: true,
      rondaActual: true,
      inicioRondaActual: true,
      duracionRondaMinutos: true,
      esperandoDecision: true,
      proveedoresInvitados: { where: { proveedorId }, select: { id: true } },
      items: { select: { id: true } },
    },
  });

  if (!licitacion) {
    return {
      ok: false,
      motivo: "licitacion_no_disponible",
      mensaje: "La licitación no existe o no admite ofertas.",
    };
  }
  if (licitacion.proveedoresInvitados.length === 0) {
    return {
      ok: false,
      motivo: "no_invitado",
      mensaje: "No estás invitado a esta licitación.",
    };
  }
  if (licitacion.estado !== "En Proceso") {
    return {
      ok: false,
      motivo: "licitacion_no_disponible",
      mensaje: "La licitación ya no está abierta a ofertas.",
    };
  }

  if (!rondaAceptable(ronda, licitacion, Date.now())) {
    return {
      ok: false,
      motivo: "fuera_de_tiempo",
      mensaje:
        "La ronda cerró antes de que llegara tu oferta. No se registró. Si la licitación abre otra ronda, podrás cotizar de nuevo.",
    };
  }

  const idsValidos = new Set(licitacion.items.map((i) => i.id));
  if (items.some((i) => !idsValidos.has(i.licitacionItemId))) {
    return {
      ok: false,
      motivo: "materiales_invalidos",
      mensaje: "Hay materiales que no pertenecen a esta licitación.",
    };
  }

  // Un precio debe ser un número REAL y positivo, salvo que la partida venga
  // marcada como "no dispongo". Se valida AQUÍ y no solo en el formulario:
  // la validación del cliente es comodidad, esta es la que manda. Sin ella,
  // cualquiera puede llamar la acción a mano y volver a meter ceros —y un 0
  // llega a preseleccionar al proveedor como ganador a $0 en la asignación.
  if (!items.every(esCapturaValida)) {
    return {
      ok: false,
      motivo: "precio_invalido",
      mensaje:
        "Cada partida necesita un precio mayor que cero, o quedar marcada como “No dispongo de esta partida”.",
    };
  }

  for (const item of items) {
    // Con "no dispongo" el precio y la cantidad se NORMALIZAN a 0: así el dato
    // queda inequívoco y no sobrevive un precio viejo de una ronda anterior que
    // luego alguien pudiera leer sin mirar el flag.
    const datos = {
      precioUnitario: item.noDisponible ? 0 : item.precioUnitario,
      cantidadDisponible: item.noDisponible ? 0 : item.cantidadDisponible,
      noDisponible: item.noDisponible,
      puedeCumplirFecha: item.puedeCumplirFecha,
      fechaEstimadaEntrega:
        item.noDisponible || !item.fechaEstimadaEntrega
          ? null
          : new Date(item.fechaEstimadaEntrega),
    };

    await prisma.ofertaItem.upsert({
      where: {
        licitacionItemId_proveedorId_ronda: {
          licitacionItemId: item.licitacionItemId,
          proveedorId,
          ronda,
        },
      },
      create: {
        licitacionItemId: item.licitacionItemId,
        proveedorId,
        ronda,
        ...datos,
      },
      update: datos,
    });
  }

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}`);
  // También la vista del COMPRADOR: antes solo se revalidaba la del proveedor,
  // así que quien entrara al detalle después de una oferta nueva podía recibir
  // una versión cacheada sin ella. No resuelve la pantalla YA abierta (de eso
  // se encarga el refresco automático de DetalleLicitacion), pero es gratis.
  revalidatePath(`${basePath}/comprador/licitaciones-proceso/${licitacionId}`);
  return { ok: true };
}
