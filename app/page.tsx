import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Evolve BA App Comercial
      </h1>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/comprador"
          className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Entrar como Comprador
        </Link>
        <Link
          href="/proveedor"
          className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Entrar como Proveedor
        </Link>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Demo white-label:{" "}
        <Link href="/grupo-andino/comprador" className="underline">
          /grupo-andino/comprador
        </Link>
      </p>
    </div>
  );
}
