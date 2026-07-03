import { cookies } from "next/headers";
import {
  CODIGO_CLIENTE_SIN_ESPECIFICAR,
  getClienteByCodigo,
} from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { PROVEEDOR_COOKIE } from "@/src/lib/proveedorSession";
import { getTotalNoLeidosProveedor } from "@/src/lib/chatActions";
import { auth } from "@/src/auth";
import { logoutAction } from "@/src/lib/authActions";
import ProveedorTestBanner from "./_components/ProveedorTestBanner";
import ProveedorSidebarWrapper from "./_components/ProveedorSidebarWrapper";

export default async function ProveedorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;
  const cliente = getClienteByCodigo(codigoCliente);

  if (!cliente) {
    return null;
  }

  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const [cookieStore, proveedoresLista, session] = await Promise.all([
    cookies(),
    prisma.proveedor.findMany({
      where: { eliminado: false },
      select: { id: true, razonSocial: true },
      orderBy: { createdAt: "asc" },
    }),
    auth(),
  ]);

  const cookieId = cookieStore.get(PROVEEDOR_COOKIE)?.value ?? "";
  const proveedorIdActual =
    proveedoresLista.find((p) => p.id === cookieId)?.id ??
    proveedoresLista[0]?.id ??
    "";

  let noLeidosInicial = 0;
  if (proveedorIdActual) {
    try {
      noLeidosInicial = await getTotalNoLeidosProveedor(proveedorIdActual);
    } catch {}
  }

  return (
    <div
      className="flex min-h-screen"
      style={
        {
          "--color-primario": cliente.colorPrimario,
          "--color-secundario": cliente.colorSecundario,
        } as React.CSSProperties
      }
    >
      <ProveedorSidebarWrapper
        basePath={basePath}
        proveedorId={proveedorIdActual}
        nombreEmpresa={cliente.nombreEmpresa}
        logoUrl={cliente.logoUrl}
        initialNoLeidos={noLeidosInicial}
        usuario={
          session?.user
            ? {
                nombre: session.user.name ?? "Usuario",
                rolNombre: (session.user as any).rolNombre ?? null,
                logoutAction,
              }
            : undefined
        }
      />
      <main className="flex flex-1 flex-col bg-white">
        <ProveedorTestBanner
          proveedores={proveedoresLista}
          proveedorIdActual={proveedorIdActual}
          basePath={basePath}
        />
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
