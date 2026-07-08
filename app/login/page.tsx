import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import LoginForm from "./_components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    const tipo = (session.user as any)?.tipoUsuario ?? "comprador";
    redirect(tipo === "proveedor" ? "/proveedor" : "/comprador");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FEFBFB] px-4">
      <LoginForm />
    </div>
  );
}
