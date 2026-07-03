import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import CambiarPasswordForm from "./_components/CambiarPasswordForm";

export default async function CambiarPasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <CambiarPasswordForm nombre={session.user?.name?.split(" ")[0] ?? "Usuario"} />
    </div>
  );
}
