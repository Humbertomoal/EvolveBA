// ─────────────────────────────────────────────────────────────────────────────
// Categorías del pipeline de licitaciones — lógica PURA (sin Prisma).
//
// Traduce el estado INTERNO de una licitación a la categoría VISIBLE del
// tablero. Los dos vocabularios no coinciden y mezclarlos es la fuente de error
// más fácil de cometer aquí:
//
//   estado interno        categoría visible
//   ──────────────        ─────────────────
//   Borrador          →   En Construcción
//   Programada        →   Por Lanzar
//   En Proceso        →   En Licitación   (rondas activas)
//   En Proceso + flag →   En Cierre/Selección
//   Cerrada           →   En Cierre/Selección
//   Esperando Valid.  →   En Cierre/Selección
//   Finalizada        →   Terminadas
//   Cancelada         →   Canceladas (fuera del pipeline)
//
// ── OJO: "Esperando Decisión" NO es un valor de Licitacion.estado ───────────
// Es un pseudo-estado: vive como el flag `esperandoDecision = true` SOBRE
// estado = "En Proceso" (ver rondasActions.ts:34, que activa el flag sin tocar
// estado, y :98, que recién ahí pasa a "Cerrada" y lo limpia). Solo existe como
// string dentro de LicitacionEstadoLog.
//
// Por eso clasificar por `estado` a secas hace que "En Licitación" y "En
// Cierre/Selección" SE TRASLAPEN y sumen de más. La discriminación por el flag
// es obligatoria, y por eso vive encapsulada en clasificarLicitacion(): fuera
// de este archivo nadie debe volver a escribir "En Proceso" a mano.
// ─────────────────────────────────────────────────────────────────────────────

// Valores internos de Licitacion.estado. Privados a propósito.
const ESTADO_BORRADOR = "Borrador";
const ESTADO_PROGRAMADA = "Programada";
const ESTADO_EN_PROCESO = "En Proceso";
const ESTADO_CERRADA = "Cerrada";
const ESTADO_ESPERANDO_VALIDACION = "Esperando Validación";
const ESTADO_FINALIZADA = "Finalizada";
const ESTADO_CANCELADA = "Cancelada";

export type CategoriaLicitacion =
  | "en_construccion"
  | "por_lanzar"
  | "en_licitacion"
  | "en_cierre"
  | "terminadas"
  | "cancelada";

export type LicitacionClasificable = {
  estado: string;
  esperandoDecision: boolean;
};

/**
 * Categoría visible de una licitación, o null si su estado no es ninguno de los
 * conocidos. Devolver null y no una categoría "de cajón" es deliberado: si
 * mañana aparece un estado nuevo, preferimos que no aparezca en ningún tile
 * (y se note al no cuadrar contra el total) antes que inflar en silencio una
 * categoría equivocada.
 */
export function clasificarLicitacion(
  lic: LicitacionClasificable
): CategoriaLicitacion | null {
  switch (lic.estado) {
    case ESTADO_BORRADOR:
      return "en_construccion";
    case ESTADO_PROGRAMADA:
      return "por_lanzar";
    case ESTADO_EN_PROCESO:
      // El flag es lo único que separa "en plena puja" de "esperando decisión".
      return lic.esperandoDecision ? "en_cierre" : "en_licitacion";
    case ESTADO_CERRADA:
    case ESTADO_ESPERANDO_VALIDACION:
      return "en_cierre";
    case ESTADO_FINALIZADA:
      return "terminadas";
    case ESTADO_CANCELADA:
      return "cancelada";
    default:
      return null;
  }
}

export const LABEL_CATEGORIA: Record<CategoriaLicitacion, string> = {
  en_construccion: "En Construcción",
  por_lanzar: "Por Lanzar",
  en_licitacion: "En Licitación",
  en_cierre: "En Cierre/Selección",
  terminadas: "Terminadas",
  cancelada: "Canceladas",
};

/**
 * Categorías del pipeline en orden del ciclo de vida. Incluye "cancelada" al
 * final porque, aunque queda fuera del flujo, es necesaria para que la suma de
 * los tiles cuadre contra el total de licitaciones.
 */
export const CATEGORIAS_PIPELINE: CategoriaLicitacion[] = [
  "en_construccion",
  "por_lanzar",
  "en_licitacion",
  "en_cierre",
  "terminadas",
  "cancelada",
];

// ── Entrada al estado actual ─────────────────────────────────────────────────

export type FechasLicitacion = {
  fechaCreacion: Date;
  fechaInicioLicitacion: Date | null;
  fechaEsperandoDecision: Date | null;
  fechaCerrada: Date | null;
  fechaFinalizada: Date | null;
  fechaCancelada: Date | null;
};

export type EntradaEstado = {
  fecha: Date;
  /** false cuando se usó un fallback aproximado (ver tabla abajo). */
  exacta: boolean;
};

/**
 * Cuándo entró la licitación al estado en el que está HOY.
 *
 * La fuente precisa es el último registro de LicitacionEstadoLog: es la única
 * que cubre "Programada" y "Esperando Validación", que no tienen campo de fecha
 * propio en Licitacion. Como esa bitácora es best-effort (estadoLog.ts traga
 * sus errores para no tumbar la operación principal), hay fallback a los
 * timestamps de la licitación:
 *
 *   Borrador             fechaCreacion            exacta
 *   Programada           fechaCreacion            APROXIMADA (no hay campo)
 *   En Proceso           fechaInicioLicitacion    exacta
 *   En Proceso + flag    fechaEsperandoDecision   exacta
 *   Cerrada              fechaCerrada             exacta
 *   Esperando Validación fechaCerrada             APROXIMADA (no hay campo)
 *   Finalizada           fechaFinalizada          exacta
 *   Cancelada            fechaCancelada           exacta
 *
 * `exacta` se propaga al UI para poder reportar cobertura en vez de presentar
 * una aproximación como si fuera medición.
 */
export function entradaAlEstadoActual(
  lic: LicitacionClasificable & FechasLicitacion,
  ultimoLogAt: Date | null
): EntradaEstado {
  if (ultimoLogAt) return { fecha: ultimoLogAt, exacta: true };

  switch (lic.estado) {
    case ESTADO_BORRADOR:
      return { fecha: lic.fechaCreacion, exacta: true };
    case ESTADO_PROGRAMADA:
      return { fecha: lic.fechaCreacion, exacta: false };
    case ESTADO_EN_PROCESO: {
      if (lic.esperandoDecision) {
        return lic.fechaEsperandoDecision
          ? { fecha: lic.fechaEsperandoDecision, exacta: true }
          : { fecha: lic.fechaCreacion, exacta: false };
      }
      return lic.fechaInicioLicitacion
        ? { fecha: lic.fechaInicioLicitacion, exacta: true }
        : { fecha: lic.fechaCreacion, exacta: false };
    }
    case ESTADO_CERRADA:
      return lic.fechaCerrada
        ? { fecha: lic.fechaCerrada, exacta: true }
        : { fecha: lic.fechaCreacion, exacta: false };
    case ESTADO_ESPERANDO_VALIDACION:
      return lic.fechaCerrada
        ? { fecha: lic.fechaCerrada, exacta: false }
        : { fecha: lic.fechaCreacion, exacta: false };
    case ESTADO_FINALIZADA:
      return lic.fechaFinalizada
        ? { fecha: lic.fechaFinalizada, exacta: true }
        : { fecha: lic.fechaCreacion, exacta: false };
    case ESTADO_CANCELADA:
      return lic.fechaCancelada
        ? { fecha: lic.fechaCancelada, exacta: true }
        : { fecha: lic.fechaCreacion, exacta: false };
    default:
      return { fecha: lic.fechaCreacion, exacta: false };
  }
}

/**
 * Duración que representa la categoría, en milisegundos.
 *
 * "Terminadas" y "Canceladas" miden el CICLO COMPLETO (creación → desenlace):
 * ya no están corriendo, así que su antigüedad en el estado final no dice nada.
 * Las categorías en curso miden ANTIGÜEDAD EN EL ESTADO (ahora − entrada), que
 * es lo que revela lo atorado.
 */
export function duracionMsCategoria(
  categoria: CategoriaLicitacion,
  lic: FechasLicitacion,
  entrada: Date,
  ahora: Date
): number | null {
  if (categoria === "terminadas") {
    if (!lic.fechaFinalizada) return null;
    return lic.fechaFinalizada.getTime() - lic.fechaCreacion.getTime();
  }
  if (categoria === "cancelada") {
    if (!lic.fechaCancelada) return null;
    return lic.fechaCancelada.getTime() - lic.fechaCreacion.getTime();
  }
  const ms = ahora.getTime() - entrada.getTime();
  return ms >= 0 ? ms : null;
}

/** Estado de OrdenCompra con el que nace: creada pero sin poner en tránsito. */
export const ESTADO_OC_PENDIENTE = "Pendiente";
