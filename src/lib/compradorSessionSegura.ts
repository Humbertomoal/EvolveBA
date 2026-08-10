// ─────────────────────────────────────────────────────────────────────────────
// Identidad del COMPRADOR — resolución SEGURA. Server-only.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Las acciones de ronda (forzar avance, cerrar, cancelar, agregar ronda) no
// validaban NADA: ni sesión, ni rol, ni estado. Y arriba tampoco había red:
// proxy.ts exige que haya sesión pero nunca compara `tipoUsuario` contra la
// sección (lo lee solo para el log), y ningún layout valida rol — algo que de
// todos modos no serviría, porque en una server action el efecto ocurre ANTES
// de renderizar el layout.
//
// Resultado: cualquier usuario autenticado —incluido un PROVEEDOR— podía forzar
// el avance o cerrar cualquier licitación con solo conocer su id. Este helper
// es la guarda que faltaba.
//
// No confundir con `compradorSession.ts`: ese lee la cookie cyrgo_comprador_id
// para decidir el ALCANCE de lo que se muestra ("ver todo" vs "solo mías"). Es
// filtrado de UI sobre una cookie que el cliente controla, no autorización.
// Aquí la identidad sale del JWT firmado de Auth.js + la BD.
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/src/auth";
import { prisma } from "./prisma";

/**
 * Perfiles INTERNOS que pueden operar el panel del comprador.
 *
 * OJO: hay tres `tipoUsuario` en la base —"comprador", "proveedor" y
 * "Administrador"— y los admins reales están dados de alta como
 * "Administrador", no como "comprador". Una guarda escrita como
 * `tipoUsuario === "comprador"` dejaría fuera a TODOS los administradores.
 *
 * Se compara en minúsculas porque el valor ya viene con mayúscula inicial en un
 * caso y sin ella en los otros; normalizar evita que un alta futura con otra
 * capitalización se quede sin acceso en silencio.
 */
const TIPOS_INTERNOS = new Set(["comprador", "administrador"]);

export type SesionComprador = {
  usuarioId: string;
  /** Valor crudo de Usuario.tipoUsuario, para la bitácora o mensajes. */
  tipoUsuario: string;
  esAdmin: boolean;
  esSupervisor: boolean;
};

/**
 * Sesión interna válida, o `null`. Allowlist deliberada: se enumeran los tipos
 * PERMITIDOS en vez de rechazar "proveedor". Con una denylist, cualquier
 * `tipoUsuario` nuevo entraría por omisión; con allowlist, queda fuera hasta que
 * alguien lo agregue a conciencia.
 */
export async function getCompradorSesionSegura(): Promise<SesionComprador | null> {
  const session = await auth();
  const usuarioId = session?.user?.id;
  if (!usuarioId) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      activo: true,
      tipoUsuario: true,
      rol: { select: { esAdmin: true, esSupervisor: true } },
    },
  });
  if (!usuario || !usuario.activo) return null;

  const tipo = (usuario.tipoUsuario ?? "").trim().toLowerCase();
  if (!TIPOS_INTERNOS.has(tipo)) return null;

  return {
    usuarioId: usuario.id,
    tipoUsuario: usuario.tipoUsuario,
    esAdmin: Boolean(usuario.rol?.esAdmin),
    esSupervisor: Boolean(usuario.rol?.esSupervisor),
  };
}

/**
 * Igual que getCompradorSesionSegura pero LANZA si no procede. Para server
 * actions: una escritura que no puede establecer quién la origina debe fallar
 * ruidosamente, nunca escribir "por si acaso".
 *
 * Se lanza (en vez de devolver un resultado) porque llegar aquí sin sesión
 * interna no es un desenlace normal de la UI —los botones no existen para un
 * proveedor—: significa que alguien invocó la acción a mano.
 */
export async function exigirCompradorSesion(): Promise<SesionComprador> {
  const sesion = await getCompradorSesionSegura();
  if (!sesion) {
    throw new Error("No autorizado: se requiere una sesión de comprador válida.");
  }
  return sesion;
}
