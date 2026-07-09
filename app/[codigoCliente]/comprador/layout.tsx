import {
  IconArchive,
  IconBox,
  IconChartBar,
  IconCheck,
  IconClock,
  IconListDetails,
  IconSend,
  IconSettings,
  IconShield,
  IconTruck,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import SidebarNav from "@/app/_components/SidebarNav";
import TopBar from "@/app/_components/TopBar";
import { PageHeaderProvider } from "@/app/_components/PageHeaderContext";
import { SidebarStateProvider } from "@/app/_components/SidebarStateContext";
import {
  CODIGO_CLIENTE_SIN_ESPECIFICAR,
  getClienteByCodigo,
} from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { logoutAction } from "@/src/lib/authActions";
import { getUsuarioActual } from "@/src/lib/usuarioActual";

const ICON_CLASSNAME = "h-4 w-4 shrink-0";

export default async function CompradorLayout({
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

  const [usuarioActual, proveedores] = await Promise.all([
    getUsuarioActual(),
    prisma.proveedor.findMany({
      where: { eliminado: false },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: "asc" },
    }),
  ]);

  const NAV_ITEMS = [
    {
      href: `${basePath}/comprador/proveedores`,
      label: "Administración de Proveedores",
      icon: <IconUsers className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/catalogo`,
      label: "Catálogo de Productos",
      icon: <IconBox className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/licitaciones/lanzamiento`,
      label: "Lanzamiento de Licitaciones",
      icon: <IconSend className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/licitaciones-proceso`,
      label: "Licitaciones en Proceso",
      icon: <IconClock className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/seleccion-proveedores`,
      label: "Selección de Proveedores",
      icon: <IconCheck className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/licitaciones-finalizadas`,
      label: "Licitaciones Finalizadas",
      icon: <IconArchive className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/ordenes`,
      label: "Órdenes de Compra",
      icon: <IconTruck className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/comprador/tablero`,
      label: "Tablero de Indicadores",
      icon: <IconChartBar className={ICON_CLASSNAME} />,
    },
    {
      label: "Configuración",
      icon: <IconSettings className={ICON_CLASSNAME} />,
      children: [
        {
          href: `${basePath}/comprador/configuracion/catalogos`,
          label: "Catálogos",
          icon: <IconListDetails className={ICON_CLASSNAME} />,
        },
        {
          href: `${basePath}/comprador/configuracion/usuarios`,
          label: "Usuarios",
          icon: <IconUser className={ICON_CLASSNAME} />,
        },
        {
          href: `${basePath}/comprador/configuracion/roles`,
          label: "Roles",
          icon: <IconShield className={ICON_CLASSNAME} />,
        },
      ],
    },
  ];

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
        <SidebarNav
          nombreEmpresa={cliente.nombreEmpresa}
          logoUrl={cliente.logoUrl}
          seccion="Comprador"
          panelHref={`${basePath}/comprador`}
          cambiarVistaHref={`${basePath}/inicio`}
          items={NAV_ITEMS}
        />
        <PageHeaderProvider>
          <div className="flex min-w-0 flex-1 flex-col">
            {usuarioActual && (
              <TopBar
                esAdmin={usuarioActual.esAdmin || usuarioActual.esSupervisor}
                basePath={basePath}
                proveedores={proveedores}
                vistaActual="comprador"
                usuario={usuarioActual}
                logoutAction={logoutAction}
              />
            )}
            <main className="min-w-0 flex-1 bg-[#FEFBFB] p-4 sm:p-8">{children}</main>
          </div>
        </PageHeaderProvider>
      </div>
    </SidebarStateProvider>
  );
}
