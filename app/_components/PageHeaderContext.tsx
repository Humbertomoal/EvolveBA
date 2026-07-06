"use client";

import { createContext, useContext, useEffect, useState } from "react";

type PageHeaderContextValue = {
  title: string;
  setTitle: (title: string) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState("");
  return (
    <PageHeaderContext.Provider value={{ title, setTitle }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderTitle() {
  const ctx = useContext(PageHeaderContext);
  return ctx?.title ?? "";
}

export function usePageTitle(title: string) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    ctx?.setTitle(title);
  }, [ctx, title]);
}

// Usable directly from a Server Component in place of a page's <h1>.
export function PageTitle({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}
