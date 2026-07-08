"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

type SidebarStateContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
};

const SidebarStateContext = createContext<SidebarStateContextValue | null>(null);

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "true") {
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  function toggleMobileOpen() {
    setMobileOpen((prev) => !prev);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <SidebarStateContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, toggleMobileOpen, closeMobile }}
    >
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    throw new Error("useSidebarState must be used within a SidebarStateProvider");
  }
  return ctx;
}
