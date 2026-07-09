"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarState } from "./SidebarStateContext";

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

export default function SidebarNav({
  nombreEmpresa,
  logoUrl,
  seccion,
  panelHref,
  cambiarVistaHref,
  items,
}: {
  nombreEmpresa: string;
  logoUrl: string;
  seccion: string;
  panelHref: string;
  cambiarVistaHref: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebarState();

  // Auto-open groups that contain the current path
  const initialOpen = items
    .filter((item) => item.children?.some((c: any) => pathname === c.href || pathname.startsWith(`${c.href}/`)))
    .map((item: any) => item.label);

  const [openGroups, setOpenGroups] = useState<string[]>(initialOpen);

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  const labelCls = `flex-1 overflow-hidden whitespace-nowrap transition-opacity duration-200 ease-out ${
    collapsed ? "opacity-0" : "opacity-100"
  }`;

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={closeMobile}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--color-primario),var(--color-secundario))] transition-all duration-200 ease-out md:relative md:z-auto md:translate-x-0 ${
          collapsed ? "w-14" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
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
          <div
            className={`flex items-center border-b border-white/15 px-4 py-5 ${
              collapsed ? "flex-col gap-2" : "gap-3"
            }`}
          >
            <Link
              href={panelHref}
              onClick={closeMobile}
              title={collapsed ? nombreEmpresa : undefined}
              className={`flex items-center gap-3 rounded-md transition-colors duration-150 ease-out hover:bg-white/10 ${
                collapsed ? "" : "min-w-0 flex-1"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={nombreEmpresa}
                width={32}
                height={32}
                className="shrink-0 rounded-md"
              />
              <div className={`flex flex-col ${labelCls}`}>
                <span className="text-sm font-semibold text-white">
                  {nombreEmpresa}
                </span>
                <span className="text-xs text-white/70">{seccion}</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
              className="hidden shrink-0 items-center justify-center rounded-md p-1.5 text-white/80 transition-colors duration-150 ease-out hover:bg-white/10 md:flex"
            >
              {collapsed ? (
                <IconLayoutSidebarLeftExpand className="h-4 w-4 shrink-0" />
              ) : (
                <IconLayoutSidebarLeftCollapse className="h-4 w-4 shrink-0" />
              )}
            </button>
          </div>

          <div className="px-3 pt-3">
            <Link
              href={cambiarVistaHref}
              onClick={closeMobile}
              title={collapsed ? "Cambiar de vista" : undefined}
              className={`flex w-full items-center gap-2 rounded-md border border-white/25 bg-white/[12%] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <IconArrowLeft className="h-4 w-4 shrink-0" />
              <span className={labelCls}>Cambiar de vista</span>
            </Link>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {items.map((item: any) => {
              if (item.children) {
                const isGroupOpen = openGroups.includes(item.label);
                const hasActiveChild = item.children.some(
                  (c: any) => pathname === c.href || pathname.startsWith(`${c.href}/`)
                );

                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.label)}
                      title={collapsed ? item.label : undefined}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                        collapsed ? "justify-center" : ""
                      } ${
                        hasActiveChild
                          ? "bg-white/20 text-white"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {item.icon}
                      <span className={`text-left ${labelCls}`}>{item.label}</span>
                      {!collapsed &&
                        (isGroupOpen ? (
                          <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-white/60" />
                        ) : (
                          <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
                        ))}
                    </button>

                    {isGroupOpen && (
                      <div className={`mt-0.5 flex flex-col gap-0.5 ${collapsed ? "" : "pl-4"}`}>
                        {item.children.map((child: any) => {
                          const isActive =
                            pathname === child.href ||
                            pathname.startsWith(`${child.href}/`);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              title={collapsed ? child.label : undefined}
                              className={`flex items-center gap-2 border-l-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                                collapsed ? "justify-center" : ""
                              } ${
                                isActive
                                  ? "border-l-primary bg-white text-primary"
                                  : "border-l-transparent text-white/75 hover:bg-white/10"
                              }`}
                            >
                              {child.icon}
                              <span className={labelCls}>{child.label}</span>
                              {!!child.badge && child.badge > 0 && (
                                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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
                  onClick={closeMobile}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2 border-l-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "border-l-primary bg-white text-primary"
                      : "border-l-transparent text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item.icon}
                  <span className={labelCls}>{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
