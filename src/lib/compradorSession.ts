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
  console.log("[getCompradorSession] cookie cyrgo_comprador_id =", compradorId);

  if (compradorId === COMPRADOR_VER_TODO) {
    console.log("[getCompradorSession] cookie === __todos__ -> puedeVerTodo=true");
    return { compradorId: COMPRADOR_VER_TODO, puedeVerTodo: true };
  }

  if (compradorId !== "default") {
    try {
      const usuario = await db.usuario.findUnique({
        where: { id: compradorId },
        include: { rol: { select: { esAdmin: true, esSupervisor: true } } },
      });
      console.log(
        "[getCompradorSession] usuario encontrado =",
        !!usuario,
        "rol =",
        usuario?.rol
      );
      if (usuario?.rol?.esAdmin || usuario?.rol?.esSupervisor) {
        console.log("[getCompradorSession] esAdmin/esSupervisor -> puedeVerTodo=true");
        return { compradorId, puedeVerTodo: true };
      }
    } catch (error) {
      console.error("[getCompradorSession] ERROR consultando usuario/rol:", error);
    }
  }

  console.log("[getCompradorSession] devolviendo puedeVerTodo=false para", compradorId);
  return { compradorId, puedeVerTodo: false };
}
