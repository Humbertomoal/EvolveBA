"use server";

import { auth, unstable_update } from "@/src/auth";
import { prisma } from "@/src/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

type State = { error?: string } | null;

export async function cambiarPasswordAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  console.log("=== cambiarPasswordAction INICIADO ===");

  const session = await auth();
  if (!session?.user?.id) {
    console.log("ERROR: sesión no válida");
    return { error: "Sesión no válida. Por favor inicia sesión de nuevo." };
  }

  const nueva = formData.get("nuevaPassword") as string;
  const confirmar = formData.get("confirmarPassword") as string;

  if (!nueva || nueva.length < 8)
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  if (nueva !== confirmar)
    return { error: "Las contraseñas no coinciden" };

  const hash = await bcrypt.hash(nueva, 12);

  await prisma.usuario.update({
    where: { id: session.user.id as string },
    data: { password: hash },
  });
  console.log("Password actualizado en BD");

  // Clear primerAcceso (requires migration)
  try {
    await (prisma as any).usuario.update({
      where: { id: session.user.id as string },
      data: { primerAcceso: false },
    });
    console.log("primerAcceso actualizado en BD");
  } catch {
    // Migration pending
  }

  // Refresh the JWT session cookie so proxy.ts doesn't see a stale
  // primerAcceso claim and bounce the user back to /cambiar-password.
 await unstable_update({ user: { primerAcceso: false } } as any);
  console.log("Sesión JWT actualizada, primerAcceso=false");

  const tipoUsuario = (session.user as any)?.tipoUsuario ?? "comprador";
  const destino = tipoUsuario === "proveedor" ? "/proveedor" : "/comprador";
  console.log("Redirigiendo a:", destino);
  redirect(destino);
}
