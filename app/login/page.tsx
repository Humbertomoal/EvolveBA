import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import LoginForm from "./_components/LoginForm";

const MENSAJES_ERROR: Record<string, string> = {
  CuentaNoRegistrada:
    "Tu cuenta no está registrada en el sistema. Contacta al administrador.",
  CuentaInactiva: "Tu cuenta está desactivada.",
  AccessDenied: "No se pudo completar el inicio de sesión con Microsoft.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) {
    const tipo = (session.user as any)?.tipoUsuario ?? "comprador";
    redirect(tipo === "proveedor" ? "/proveedor" : "/comprador");
  }

  const { error } = await searchParams;
  const errorMicrosoft = error ? (MENSAJES_ERROR[error] ?? null) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FEFBFB] px-4">
      <LoginForm errorMicrosoft={errorMicrosoft} />
    </div>
  );
}
