import { auth } from "@/src/auth";
import { prisma } from "./prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type UsuarioActual = {
  nombre: string;
  email: string;
  rolNombre: string | null;
  esAdmin: boolean;
  esSupervisor: boolean;
};

export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const session = await auth();
  if (!session?.user) return null;

  const nombre = session.user.name ?? "Usuario";
  const email = session.user.email ?? "";

  try {
    const usuario = await db.usuario.findUnique({
      where: { id: session.user.id },
      include: { rol: { select: { nombre: true, esAdmin: true, esSupervisor: true } } },
    });

    return {
      nombre,
      email,
      rolNombre: usuario?.rol?.nombre ?? null,
      esAdmin: usuario?.rol?.esAdmin ?? false,
      esSupervisor: usuario?.rol?.esSupervisor ?? false,
    };
  } catch {
    // Migration not yet applied — fall back to session-only data
    return { nombre, email, rolNombre: null, esAdmin: false, esSupervisor: false };
  }
}
