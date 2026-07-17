import Link from "next/link";
import { redirect } from "next/navigation";
import { IconChartLine, IconRocket, IconShieldCheck } from "@tabler/icons-react";
import { auth } from "@/src/auth";
import { getConfigEmpresa } from "@/src/config/empresa";

const BENEFICIOS = [
  { icon: IconRocket, texto: "Eficiencia en el proceso comercial" },
  { icon: IconChartLine, texto: "Seguimiento de licitaciones en tiempo real" },
  { icon: IconShieldCheck, texto: "Transparencia y trazabilidad total" },
];

export default async function Home() {
  const session = await auth();
  if (session) {
    const tipo = (session.user as any)?.tipoUsuario ?? "comprador";
    redirect(tipo === "proveedor" ? "/proveedor" : "/comprador");
  }

  const empresa = getConfigEmpresa();
  const inicial = empresa.nombreEmpresa.charAt(0).toUpperCase();

  return (
    <div
      className="flex min-h-screen flex-col bg-[#FEFBFB]"
      style={{ "--color-primario": empresa.colorPrimario } as React.CSSProperties}
    >
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          {empresa.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logoUrl}
              alt={empresa.nombreEmpresa}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {inicial}
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-zinc-800">
              {empresa.nombreEmpresa}
            </span>
            <span className="text-xs text-zinc-400">{empresa.nombreComercial}</span>
          </div>
        </div>

        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-50"
        >
          Iniciar sesión
        </Link>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10" />
        <div className="pointer-events-none absolute -right-16 -bottom-32 h-96 w-96 rounded-full bg-primary/5" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-primary/5" />

        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6">
          {empresa.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logoUrl}
              alt={empresa.nombreEmpresa}
              className="h-20 w-20 rounded-2xl object-cover shadow-card"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-semibold text-white shadow-card">
              {inicial}
            </div>
          )}

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-primary sm:text-5xl">
              {empresa.nombreComercial}
            </h1>
            <p className="text-lg font-medium text-zinc-700">
              Plataforma inteligente de gestión de licitaciones y proceso comercial
            </p>
            <p className="mx-auto max-w-xl text-sm text-zinc-500">
              Plataforma digital que conecta compradores y proveedores en un
              proceso de licitaciones ágil, transparente y en tiempo real.
              Moderniza tu operación comercial con trazabilidad completa de
              principio a fin.
            </p>
          </div>

          <Link
            href="/login"
            className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-white shadow-card transition-colors duration-150 hover:bg-primary-dark"
          >
            Iniciar sesión
          </Link>

          {/* Píldoras de beneficios */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {BENEFICIOS.map(({ icon: Icon, texto }) => (
              <div
                key={texto}
                className="flex items-center gap-3 rounded-card border border-border bg-white px-5 py-4 shadow-card"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium text-zinc-700">{texto}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-zinc-400">
        {empresa.nombreEmpresa} © 2026 · Desarrollado para optimizar tu proceso
        de compras
      </footer>
    </div>
  );
}
