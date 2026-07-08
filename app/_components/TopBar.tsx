"use client";

import { useRouter } from "next/navigation";
import { IconChevronDown, IconEye, IconLogout, IconMenu2 } from "@tabler/icons-react";
import { usePageHeaderTitle } from "./PageHeaderContext";
import { useSidebarState } from "./SidebarStateContext";

const PROVEEDOR_COOKIE = "cyrgo_proveedor_id";
const VISTA_COMPRADOR = "__comprador__";

type Proveedor = { id: string; razonSocial: string };

type UsuarioInfo = {
  nombre: string;
  email: string;
  rolNombre: string | null;
};

export default function TopBar({
  esAdmin,
  basePath,
  proveedores,
  vistaActual,
  proveedorIdActual,
  usuario,
  logoutAction,
}: {
  esAdmin: boolean;
  basePath: string;
  proveedores: Proveedor[];
  vistaActual: "comprador" | "proveedor";
  proveedorIdActual?: string;
  usuario: UsuarioInfo;
  logoutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const titulo = usePageHeaderTitle();
  const { toggleMobileOpen } = useSidebarState();

  function handleChangeVista(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;

    if (val === VISTA_COMPRADOR) {
      if (vistaActual === "proveedor") {
        router.push(`${basePath}/comprador`);
      }
      return;
    }

    document.cookie = `${PROVEEDOR_COOKIE}=${val}; path=/; max-age=86400; SameSite=Lax`;
    if (vistaActual === "comprador") {
      router.push(`${basePath}/proveedor/licitaciones`);
    } else {
      router.refresh();
    }
  }

  const iniciales = usuario.nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 shadow-card sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleMobileOpen}
          title="Abrir menú"
          className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
        >
          <IconMenu2 className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-zinc-900">{titulo}</h1>
      </div>

      <div className="flex items-center gap-3">
        {esAdmin && (
          <div className="flex items-center gap-1.5 rounded-[20px] border border-blue-200 bg-blue-50 py-1 pl-2.5 pr-1.5 text-sm text-blue-700">
            <IconEye className="h-4 w-4 shrink-0" />
            <span>Viendo como:</span>
            <select
              value={vistaActual === "proveedor" ? proveedorIdActual ?? "" : VISTA_COMPRADOR}
              onChange={handleChangeVista}
              className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-blue-700 focus:outline-none"
            >
              <option value={VISTA_COMPRADOR}>Comprador</option>
              {proveedores.length > 0 && (
                <option value="" disabled>
                  ──────────────
                </option>
              )}
              {proveedores.map((p: any)=> (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                </option>
              ))}
            </select>
            <IconChevronDown className="h-3.5 w-3.5 shrink-0" />
          </div>
        )}

        {usuario.rolNombre && (
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
            {usuario.rolNombre}
          </span>
        )}

        <div className="flex items-center gap-2.5 pl-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {iniciales}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{usuario.nombre}</p>
            <p className="truncate text-xs text-zinc-500">{usuario.email}</p>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <IconLogout className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
