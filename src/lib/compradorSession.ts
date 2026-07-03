import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const COMPRADOR_COOKIE = "cyrgo_comprador_id";
export const COMPRADOR_VER_TODO = "__todos__";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function getCompradorIdActual(): Promise<string> {
  const store = await cookies();
  return store.get(COMPRADOR_COOKIE)?.value ?? "default";
}

export async function getCompradorSession(): Promise<{
  compradorId: string;
  puedeVerTodo: boolean;
}> {
  const store = await cookies();
  const compradorId = store.get(COMPRADOR_COOKIE)?.value ?? "default";

  if (compradorId === COMPRADOR_VER_TODO) {
    return { compradorId: COMPRADOR_VER_TODO, puedeVerTodo: true };
  }

  if (compradorId !== "default") {
    try {
      const usuario = await db.usuario.findUnique({
        where: { id: compradorId },
        include: { rol: { select: { esAdmin: true, esSupervisor: true } } },
      });
      if (usuario?.rol?.esAdmin || usuario?.rol?.esSupervisor) {
        return { compradorId, puedeVerTodo: true };
      }
    } catch {
      // Migration not yet applied — treat as filtered
    }
  }

  return { compradorId, puedeVerTodo: false };
}
