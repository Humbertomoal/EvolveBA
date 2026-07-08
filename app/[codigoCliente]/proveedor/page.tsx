import { IconBuilding, IconGavel } from "@tabler/icons-react";
import Link from "next/link";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { prisma } from "@/src/lib/prisma";
import { getProveedorIdActual } from "@/src/lib/proveedorSession";
import { PageTitle } from "@/app/_components/PageHeaderContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function ProveedorHomePage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;

  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const proveedorId = await getProveedorIdActual();

  // ── Métricas ────────────────────────────────────────────────────────────────
  let licitacionesActivas = 0;
  let ocPendientes = 0;
  let desempenoValor: string | null = null;

  if (proveedorId) {
    try {
      [licitacionesActivas, ocPendientes] = await Promise.all([
        db.licitacionProveedor.count({
          where: {
            proveedorId,
            licitacion: {
              eliminado: false,
              estado: { in: ["Programada", "En Proceso"] },
              modoLicitacion: { not: "Manual" },
            },
          },
        }),
        db.ordenCompra.count({
          where: {
            proveedorId,
            estado: { in: ["Pendiente", "En tránsito"] },
          },
        }),
      ]);
    } catch {
      // Models not yet migrated — keep defaults
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ocEntregadas: any[] = await db.ordenCompra.findMany({
        where: {
          proveedorId,
          estado: { in: ["Entregada", "Recibida"] },
        },
        select: { fechaEstimadaEntrega: true, updatedAt: true },
      });

      if (ocEntregadas.length > 0) {
        const aTiempo = ocEntregadas.filter(
          (oc) =>
            !oc.fechaEstimadaEntrega ||
            new Date(oc.updatedAt) <= new Date(oc.fechaEstimadaEntrega)
        ).length;
        desempenoValor = `${Math.round((aTiempo / ocEntregadas.length) * 100)}%`;
      }
    } catch {
      // Keep desempenoValor = null ("Sin datos")
    }
  }

  const metricas: { label: string; valor: string | number; subtexto: string }[] = [
    {
      label: "Licitaciones activas",
      valor: licitacionesActivas,
      subtexto: "En las que participas actualmente",
    },
    {
      label: "Órdenes de compra pendientes",
      valor: ocPendientes,
      subtexto: "Pendientes y en tránsito",
    },
    {
      label: "Mi desempeño",
      valor: desempenoValor ?? "—",
      subtexto: desempenoValor ? "Órdenes entregadas a tiempo" : "Sin datos suficientes",
    },
  ];

  const accesos = [
    {
      href: `${basePath}/proveedor/licitaciones`,
      label: "Ver mis licitaciones",
      icon: <IconGavel className="h-5 w-5 shrink-0" />,
    },
    {
      href: `${basePath}/proveedor/catalogo`,
      label: "Mi catálogo e información",
      icon: <IconBuilding className="h-5 w-5 shrink-0" />,
    },
  ];

  return (
    <div className="max-w-3xl">
      <PageTitle title="Panel de Proveedor" />
      <p className="mt-1 text-sm text-zinc-500">
        Resumen de tu actividad como proveedor
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
        {accesos.map((a: any) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <span className="text-[var(--color-primario)]">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
