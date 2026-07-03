import { IconSend, IconUsers } from "@tabler/icons-react";
import Link from "next/link";
import { prisma } from "@/src/lib/prisma";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCompradorSession } from "@/src/lib/compradorSession";

export default async function CompradorHomePage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;

  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const [licitacionesActivas, proveedoresActivos, totalProveedores, totalProductos] =
    await Promise.all([
      prisma.licitacion.count({
        where: {
          eliminado: false,
          estado: { in: ["Programada", "En Proceso"] },
          ...(puedeVerTodo ? {} : { compradorId }),
        },
      }),
      prisma.proveedor.count({ where: { eliminado: false, estado: "Activo" } }),
      prisma.proveedor.count({ where: { eliminado: false } }),
      prisma.producto.count({ where: { eliminado: false } }),
    ]);

  const metricas: { label: string; valor: number | string; subtexto: string }[] = [
    {
      label: "Licitaciones activas",
      valor: licitacionesActivas,
      subtexto: "Programadas y en proceso",
    },
    {
      label: "Proveedores activos",
      valor: proveedoresActivos,
      subtexto: `De un total de ${totalProveedores}`,
    },
    {
      label: "Productos en catálogo",
      valor: totalProductos,
      subtexto: "Items disponibles",
    },
  ];

  const accesos = [
    {
      href: `${basePath}/comprador/licitaciones/nueva`,
      label: "Lanzar licitación",
      icon: <IconSend className="h-5 w-5 shrink-0" />,
    },
    {
      href: `${basePath}/comprador/proveedores/nuevo`,
      label: "Agregar proveedor",
      icon: <IconUsers className="h-5 w-5 shrink-0" />,
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Panel de Comprador
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Resumen general de tu actividad de compras
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {metricas.map((m) => (
          <div key={m.label} className="rounded-xl bg-zinc-50 px-5 py-4">
            <span className="text-xs font-medium text-zinc-500">{m.label}</span>
            <p className="mt-1 text-4xl font-bold text-[var(--color-primario)]">
              {m.valor}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{m.subtexto}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold text-zinc-700">
        Accesos rápidos
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <span className="text-[var(--color-primario)]">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
