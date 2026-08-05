import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Bitácora de cambios de estado de licitaciones (LicitacionEstadoLog).
//
// Server-side únicamente (importa Prisma) — NO usar en componentes cliente.
// El registro es best-effort: si falla, se loguea el error pero NUNCA se lanza,
// para no tumbar la operación principal (creación/actualización de licitación,
// avance de ronda, asignación, etc.).
//
// Los 8 estados canónicos que se registran (incluye el pseudo-estado "Esperando
// Decisión", que en el modelo Licitacion vive como el flag esperandoDecision
// sobre estado="En Proceso", pero como etapa merece su propia entrada):
//   Borrador · Programada · En Proceso · Esperando Decisión · Cerrada ·
//   Esperando Validación · Finalizada · Cancelada
//
// "Esperando Validación" (ver seleccionTypes.ts) se registra desde
// asignacionActions.ts al mandar la asignación preliminar. Faltaba en esta
// lista, que decía 7 estados.
//
// OJO al agregar o quitar estados: src/lib/tableroEtapas.ts (ETAPAS_MEDIBLES)
// y ESTADOS_EJECUTADAS en tableroQueries.ts dependen de estos nombres para los
// indicadores de tiempo por etapa del Tablero.
// ─────────────────────────────────────────────────────────────────────────────

export const ESTADO_ESPERANDO_DECISION = "Esperando Decisión";

/**
 * Registra una transición de estado de una licitación. Best-effort: envuelto
 * defensivamente, nunca lanza. Si `estadoAnterior === estadoNuevo` no registra
 * nada (no hubo cambio real).
 */
export async function registrarCambioEstado(
  licitacionId: string,
  estadoAnterior: string | null,
  estadoNuevo: string,
  usuarioId?: string | null
): Promise<void> {
  if (estadoAnterior === estadoNuevo) return;
  try {
    await prisma.licitacionEstadoLog.create({
      data: {
        licitacionId,
        estadoAnterior: estadoAnterior ?? null,
        estadoNuevo,
        usuarioId: usuarioId ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[registrarCambioEstado] no se pudo registrar el cambio de estado",
      { licitacionId, estadoAnterior, estadoNuevo },
      error
    );
  }
}

/**
 * Id del usuario autenticado que ejecuta la acción, o null si no se puede
 * resolver (transición automática/de sistema, o sin sesión). Nunca lanza.
 */
export async function getUsuarioIdActual(): Promise<string | null> {
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}
