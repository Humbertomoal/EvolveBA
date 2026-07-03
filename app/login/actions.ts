"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/src/auth";
import { prisma } from "@/src/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function loginAction(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) return "Por favor ingresa correo y contraseña";

  // Verify credentials to set cookies before the redirect
  let usuario: { id: string; password: string | null; activo: boolean } | null = null;
  try {
    usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, password: true, activo: true },
    });
  } catch {
    return "Error al conectar con la base de datos";
  }

  if (!usuario?.activo || !usuario.password) return "Credenciales incorrectas";

  console.log("=== DEBUG LOGIN ===");
  console.log("Email:", email);
  console.log("Password ingresado:", password);
  console.log("Hash en BD:", usuario.password?.substring(0, 20));
  const ok = await bcrypt.compare(password, usuario.password);
  console.log("bcrypt resultado:", ok);
  if (!ok) return "Credenciales incorrectas";

  // Read new fields (available after migration)
  let tipoUsuario = "comprador";
  let primerAcceso = false;
  try {
    const extra = await (prisma as any).usuario.findUnique({
      where: { id: usuario.id },
      select: { tipoUsuario: true, primerAcceso: true },
    });
    tipoUsuario = extra?.tipoUsuario ?? "comprador";
    primerAcceso = extra?.primerAcceso ?? false;
  } catch {
    // Migration pending — use defaults
  }

  // Set panel cookie before signIn throws redirect
  const cookieStore = await cookies();
  if (tipoUsuario === "comprador") {
    cookieStore.set("cyrgo_comprador_id", usuario.id, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else if (tipoUsuario === "proveedor") {
    // Look up linked Proveedor record
    try {
      const proveedor = await (prisma as any).proveedor.findFirst({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      if (proveedor?.id) {
        cookieStore.set("cyrgo_proveedor_id", proveedor.id, {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    } catch {
      // Migration pending
    }
  }

  const destino = primerAcceso
    ? "/cambiar-password"
    : tipoUsuario === "proveedor"
    ? "/proveedor"
    : "/comprador";

  try {
    await signIn("credentials", { email, password, redirectTo: destino });
  } catch (err) {
    if (err instanceof AuthError) return "Credenciales incorrectas";
    throw err; // Re-throw NEXT_REDIRECT
  }

  return null;
}
