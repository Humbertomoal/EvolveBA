"use client";

import { useState } from "react";
import { IconArrowLeft, IconChevronDown, IconChevronRight, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavChild = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

type NavItem = {
  href?: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  children?: NavChild[];
};

type UsuarioInfo = {
  nombre: string;
  rolNombre: string | null;
  logoutAction: () => Promise<void>;
};

export default function SidebarNav({
  nombreEmpresa,
  logoUrl,
  seccion,
  panelHref,
  cambiarVistaHref,
  items,
  usuario,
}: {
  nombreEmpresa: string;
  logoUrl: string;
  seccion: string;
  panelHref: string;
  cambiarVistaHref: string;
  items: NavItem[];
  usuario?: UsuarioInfo;
}) {
  const pathname = usePathname();

  // Auto-open groups that contain the current path
  const initialOpen = items
    .filter((item) => item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)))
    .map((item) => item.label);

  const [openGroups, setOpenGroups] = useState<string[]>(initialOpen);

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  return (
    <aside className="relative w-64 shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--color-primario),var(--color-secundario))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-[110px] w-[110px] rotate-[22deg] rounded-lg bg-white/[11%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -left-14 h-[160px] w-[160px] rotate-[30deg] rounded-lg bg-white/[10%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-2 bottom-36 h-[95px] w-[95px] rotate-[18deg] rounded-lg bg-white/[12%]"
      />

      <div className="relative z-10 flex h-full flex-col overflow-hidden">
        <Link
          href={panelHref}
          className="flex items-center gap-3 border-b border-white/15 px-6 py-5 transition-colors hover:bg-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            width={32}
            height={32}
            className="rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">
              {nombreEmpresa}
            </span>
            <span className="text-xs text-white/70">{seccion}</span>
          </div>
        </Link>

        <div className="px-3 pt-3">
          <Link
            href={cambiarVistaHref}
            className="flex w-full items-center gap-2 rounded-md border border-white/25 bg-white/[12%] px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <IconArrowLeft className="h-4 w-4 shrink-0" />
            Cambiar de vista
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map((item) => {
            if (item.children) {
              const isGroupOpen = openGroups.includes(item.label);
              const hasActiveChild = item.children.some(
                (c) => pathname === c.href || pathname.startsWith(`${c.href}/`)
              );

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      hasActiveChild
                        ? "bg-white/20 text-white"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    {isGroupOpen ? (
                      <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-white/60" />
                    ) : (
                      <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
                    )}
                  </button>

                  {isGroupOpen && (
                    <div className="mt-0.5 flex flex-col gap-0.5 pl-4">
                      {item.children.map((child) => {
                        const isActive =
                          pathname === child.href ||
                          pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-white text-[var(--color-primario)]"
                                : "text-white/75 hover:bg-white/10"
                            }`}
                          >
                            {child.icon}
                            <span className="flex-1">{child.label}</span>
                            {!!child.badge && child.badge > 0 && (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {child.badge > 99 ? "99+" : child.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (!item.href) return null;

            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-[var(--color-primario)]"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {usuario && (
          <div className="border-t border-white/15 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
                {usuario.nombre
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {usuario.nombre}
                </p>
                {usuario.rolNombre && (
                  <p className="truncate text-[10px] text-white/60">
                    {usuario.rolNombre}
                  </p>
                )}
              </div>
              <form action={usuario.logoutAction}>
                <button
                  type="submit"
                  title="Cerrar sesión"
                  className="shrink-0 rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <IconLogout className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
