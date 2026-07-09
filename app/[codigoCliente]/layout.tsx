import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { getClienteByCodigo } from "@/src/lib/getClienteByCodigo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}): Promise<Metadata> {
  const { codigoCliente } = await params;
  const cliente = getClienteByCodigo(codigoCliente);

  if (!cliente) {
    return { title: "Cliente no encontrado · Evolve BA App Comercial" };
  }

  return {
    title: `${cliente.nombreEmpresa} · Evolve BA App Comercial`,
    icons: { icon: cliente.faviconUrl },
  };
}

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const cliente = getClienteByCodigo(codigoCliente);

  if (!cliente) {
    notFound();
  }

  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: "10px",
            fontSize: "13px",
            fontFamily: "inherit",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            padding: "10px 14px",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
    </>
  );
}
