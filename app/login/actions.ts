"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/src/auth";
import { prisma } from "@/src/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const DOMINIO_CORPORATIVO = "@evolveba.com.mx";

export type MetodoAcceso =
  | { metodo: "microsoft" }
  | { metodo: "password" }
  | { metodo: "no_encontrado"; mensaje: string };

export async function verificarMetodoAcceso(
  emailInput: string
): Promise<MetodoAcceso> {
  const email = emailInput?.trim().toLowerCase();
  console.log("=== VERIFICAR METODO ACCESO ===");
  console.log("Email recibido:", email);

  if (!email) {
    return { metodo: "no_encontrado", mensaje: "Ingresa un correo válido." };
  }

  let usuario: { tipoUsuario: string; microsoftId: string | null } | null;
  try {
    usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { tipoUsuario: true, microsoftId: true },
    });
  } catch (error) {
    console.error("ERROR consultando usuario en verificarMetodoAcceso:", error);
    return {
      metodo: "no_encontrado",
      mensaje: "Error al verificar el correo. Intenta de nuevo.",
    };
  }

  console.log("Usuario encontrado:", !!usuario);

  if (!usuario) {
    const resultado: MetodoAcceso = {
      metodo: "no_encontrado",
      mensaje: "Correo no registrado. Contacta al administrador.",
    };
    console.log("Método decidido:", resultado.metodo);
    return resultado;
  }

  const esDominioCorporativo = email.endsWith(DOMINIO_CORPORATIVO);
  const usaMicrosoft =
    usuario.tipoUsuario === "comprador" ||
    !!usuario.microsoftId ||
    esDominioCorporativo;

  const resultado: MetodoAcceso = usaMicrosoft
    ? { metodo: "microsoft" }
    : { metodo: "password" };
  console.log("Método decidido:", resultado.metodo);
  return resultado;
}

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
