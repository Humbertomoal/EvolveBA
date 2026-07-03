import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClienteByCodigo } from "@/src/lib/getClienteByCodigo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}): Promise<Metadata> {
  const { codigoCliente } = await params;
  const cliente = getClienteByCodigo(codigoCliente);

  if (!cliente) {
    return { title: "Cliente no encontrado · CYRGO" };
  }

  return {
    title: `${cliente.nombreEmpresa} · CYRGO`,
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

  return children;
}
