"use client";

import { useEffect, useState } from "react";
import {
  IconBuilding,
  IconClipboardList,
  IconGavel,
  IconTrendingUp,
} from "@tabler/icons-react";
import SidebarNav from "@/app/_components/SidebarNav";
import { getTotalNoLeidosProveedor } from "@/src/lib/chatActions";

const ICON_CLASSNAME = "h-4 w-4 shrink-0";

export default function ProveedorSidebarWrapper({
  basePath,
  proveedorId,
  nombreEmpresa,
  logoUrl,
  initialNoLeidos,
}: {
  basePath: string;
  proveedorId: string;
  nombreEmpresa: string;
  logoUrl: string;
  initialNoLeidos: number;
}) {
  const [noLeidos, setNoLeidos] = useState(initialNoLeidos);

  useEffect(() => {
    if (!proveedorId) return;
    const poll = async () => {
      const count = await getTotalNoLeidosProveedor(proveedorId);
      setNoLeidos(count);
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [proveedorId]);

  const NAV_ITEMS = [
    {
      href: `${basePath}/proveedor/catalogo`,
      label: "Mi Catálogo y Mi Información",
      icon: <IconBuilding className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/proveedor/licitaciones`,
      label: "Mis Licitaciones",
      icon: <IconGavel className={ICON_CLASSNAME} />,
      badge: noLeidos > 0 ? noLeidos : undefined,
    },
    {
      href: `${basePath}/proveedor/ordenes`,
      label: "Mis Órdenes de Compra",
      icon: <IconClipboardList className={ICON_CLASSNAME} />,
    },
    {
      href: `${basePath}/proveedor/desempeno`,
      label: "Mi Desempeño",
      icon: <IconTrendingUp className={ICON_CLASSNAME} />,
    },
  ];

  return (
    <SidebarNav
      nombreEmpresa={nombreEmpresa}
      logoUrl={logoUrl}
      seccion="Proveedor"
      panelHref={`${basePath}/proveedor`}
      cambiarVistaHref={`${basePath}/inicio`}
      items={NAV_ITEMS}
    />
  );
}
