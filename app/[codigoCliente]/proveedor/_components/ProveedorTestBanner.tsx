"use client";

import { useRouter } from "next/navigation";

const COOKIE_NAME = "cyrgo_proveedor_id";

type Proveedor = { id: string; razonSocial: string };

export default function ProveedorTestBanner({
  proveedores,
  proveedorIdActual,
  basePath,
}: {
  proveedores: Proveedor[];
  proveedorIdActual: string;
  basePath: string;
}) {
  const router = useRouter();

  if (proveedores.length === 0) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    document.cookie = `${COOKIE_NAME}=${e.target.value}; path=/; max-age=86400; SameSite=Lax`;
    router.refresh();
  }

  function volverComprador() {
    router.push(`${basePath}/comprador`);
  }

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-blue-200 bg-blue-50 px-6 py-2 text-sm text-blue-800">
      <span>🔧</span>
      <span className="text-blue-700">Viendo como proveedor:</span>
      <select
        value={proveedorIdActual}
        onChange={handleChange}
        className="rounded border border-blue-300 bg-white px-2 py-0.5 text-sm text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.razonSocial}
          </option>
        ))}
      </select>
      <span className="text-blue-300">—</span>
      <button
        type="button"
        onClick={volverComprador}
        className="font-medium text-blue-700 underline underline-offset-2 transition-colors hover:text-blue-900"
      >
        Volver a vista Comprador
      </button>
    </div>
  );
}
