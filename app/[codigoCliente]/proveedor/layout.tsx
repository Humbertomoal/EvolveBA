import {
  CODIGO_CLIENTE_SIN_ESPECIFICAR,
  getClienteByCodigo,
} from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getProveedorSessionSegura } from "@/src/lib/proveedorSessionSegura";
import {
  getAvisosRondaPendientes,
  getTotalNoLeidosProveedor,
} from "@/src/lib/chatActions";
import { logoutAction } from "@/src/lib/authActions";
import { getUsuarioActual } from "@/src/lib/usuarioActual";
import TopBar from "@/app/_components/TopBar";
import { PageHeaderProvider } from "@/app/_components/PageHeaderContext";
import { SidebarStateProvider } from "@/app/_components/SidebarStateContext";
import ProveedorSidebarWrapper from "./_components/ProveedorSidebarWrapper";
import BandaAvisosProveedor from "./_components/BandaAvisosProveedor";
import type { AvisoLicitacionPendiente } from "@/src/lib/avisosProveedorTypes";

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

  // Identidad desde el JWT firmado (getProveedorSessionSegura), NO desde la
  // cookie cyrgo_proveedor_id, que es escribible desde el navegador. Antes se
  // leía la cookie y, si no coincidía con nada, se caía al PRIMER proveedor de
  // la base — dos formas de acabar mostrando datos ajenos.
  const [sesionProveedor, usuarioActual] = await Promise.all([
    getProveedorSessionSegura(),
    getUsuarioActual(),
  ]);

  const proveedorIdActual = sesionProveedor?.proveedorId ?? "";

  // El desplegable de "ver como proveedor" es exclusivo de admins/supervisores.
  // Para un proveedor la lista va vacía a propósito: antes se le enviaba al
  // navegador la razón social de TODOS sus competidores dentro del payload de
  // la página, aunque el selector no se dibujara.
  const puedeImpersonar = Boolean(
    usuarioActual && (usuarioActual.esAdmin || usuarioActual.esSupervisor)
  );
  const proveedoresLista = puedeImpersonar
    ? await prisma.proveedor.findMany({
        where: { eliminado: false },
        select: { id: true, razonSocial: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Estado inicial resuelto en el servidor para que el badge y la banda salgan
  // ya pintados en el primer render, sin esperar al primer sondeo de 30 s.
  let noLeidosInicial = 0;
  let avisosIniciales: AvisoLicitacionPendiente[] = [];
  if (proveedorIdActual) {
    try {
      [noLeidosInicial, avisosIniciales] = await Promise.all([
        getTotalNoLeidosProveedor(proveedorIdActual),
        getAvisosRondaPendientes(proveedorIdActual),
      ]);
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
            {/* Debajo del TopBar (sticky top-0, h-16) para no taparlo. Vive en
                el layout, así que acompaña al proveedor por todo el portal. */}
            {proveedorIdActual && (
              <BandaAvisosProveedor
                basePath={basePath}
                proveedorId={proveedorIdActual}
                avisosIniciales={avisosIniciales}
              />
            )}
            <div className="p-4 sm:p-8">{children}</div>
          </main>
        </PageHeaderProvider>
      </div>
    </SidebarStateProvider>
  );
}
