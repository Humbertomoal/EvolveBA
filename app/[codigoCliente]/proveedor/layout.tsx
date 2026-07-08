import { cookies } from "next/headers";
import {
  CODIGO_CLIENTE_SIN_ESPECIFICAR,
  getClienteByCodigo,
} from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { PROVEEDOR_COOKIE } from "@/src/lib/proveedorSession";
import { getTotalNoLeidosProveedor } from "@/src/lib/chatActions";
import { logoutAction } from "@/src/lib/authActions";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import TopBar from "@/app/_components/TopBar";
import { PageHeaderProvider } from "@/app/_components/PageHeaderContext";
import { SidebarStateProvider } from "@/app/_components/SidebarStateContext";
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

  const [cookieStore, proveedoresLista, usuarioActual] = await Promise.all([
    cookies(),
    prisma.proveedor.findMany({
      where: { eliminado: false },
      select: { id: true, razonSocial: true },
      orderBy: { createdAt: "asc" },
    }),
    getUsuarioActual(),
  ]);

  const cookieId = cookieStore.get(PROVEEDOR_COOKIE)?.value ?? "";
  const proveedorIdActual =
    proveedoresLista.find((p: any)  => p.id === cookieId)?.id ??
    proveedoresLista[0]?.id ??
    "";

  let noLeidosInicial = 0;
  if (proveedorIdActual) {
    try {
      noLeidosInicial = await getTotalNoLeidosProveedor(proveedorIdActual);
    } catch {}
  }

  return (
    <SidebarStateProvider>
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
        />
        <PageHeaderProvider>
          <main className="flex flex-1 flex-col bg-[#FEFBFB]">
            {usuarioActual && (
              <TopBar
                esAdmin={usuarioActual.esAdmin || usuarioActual.esSupervisor}
                basePath={basePath}
                proveedores={proveedoresLista}
                vistaActual="proveedor"
                proveedorIdActual={proveedorIdActual}
                usuario={usuarioActual}
                logoutAction={logoutAction}
              />
            )}
            <div className="p-4 sm:p-8">{children}</div>
          </main>
        </PageHeaderProvider>
      </div>
    </SidebarStateProvider>
  );
}
