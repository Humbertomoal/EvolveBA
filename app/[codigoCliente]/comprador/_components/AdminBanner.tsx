"use client";

import { useRouter } from "next/navigation";

const COOKIE_NAME = "cyrgo_proveedor_id";

type Proveedor = { id: string; razonSocial: string };

export default function AdminBanner({
  proveedores,
  basePath,
}: {
  proveedores: Proveedor[];
  basePath: string;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (!val || val === "__comprador__") return;
    document.cookie = `${COOKIE_NAME}=${val}; path=/; max-age=86400; SameSite=Lax`;
    router.push(`${basePath}/proveedor/licitaciones`);
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-blue-200 bg-blue-50 px-6 py-2 text-sm text-blue-800">
      <span>🔧</span>
      <span className="font-semibold">Modo Administrador</span>
      <span className="text-blue-300">—</span>
      <span className="text-blue-700">Viendo como:</span>
      <select
        defaultValue="__comprador__"
        onChange={handleChange}
        className="rounded border border-blue-300 bg-white px-2 py-0.5 text-sm text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="__comprador__">Comprador (vista actual)</option>
        {proveedores.length > 0 && (
          <option value="" disabled>
            ──────────────
          </option>
        )}
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.razonSocial}
          </option>
        ))}
      </select>
    </div>
  );
}
