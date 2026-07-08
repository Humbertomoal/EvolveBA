import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconBox,
  IconFileInvoice,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { prisma } from "@/src/lib/prisma";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { getCompradorSession } from "@/src/lib/compradorSession";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import LicitacionesPorMesChart, {
  type LicitacionesPorMesPunto,
} from "./_components/LicitacionesPorMesChart";

function calcularDelta(actual: number, anterior: number): { delta: number; pct: number | null } {
  return {
    delta: actual - anterior,
    pct: anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null,
  };
}

export default async function CompradorHomePage({
  params,
}: {
  params: Promise<{ codigoCliente: string }>;
}) {
  const { codigoCliente } = await params;

  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  const { compradorId, puedeVerTodo } = await getCompradorSession();

  const ahora = new Date();
  const hace30 = new Date(ahora);
  hace30.setDate(hace30.getDate() - 30);
  const hace60 = new Date(ahora);
  hace60.setDate(hace60.getDate() - 60);
  const hace6Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);

  const licitacionFiltroBase = puedeVerTodo ? {} : { compradorId };

  const [
    licitacionesActivas,
    proveedoresActivos,
    totalProveedores,
    totalProductos,
    licitacionesUltimos30,
    licitacionesPrevios30,
    proveedoresUltimos30,
    proveedoresPrevios30,
    productosUltimos30,
    productosPrevios30,
    licitacionesParaChart,
  ] = await Promise.all([
    prisma.licitacion.count({
      where: {
        eliminado: false,
        estado: { in: ["Programada", "En Proceso"] },
        ...licitacionFiltroBase,
      },
    }),
    prisma.proveedor.count({ where: { eliminado: false, estado: "Activo" } }),
    prisma.proveedor.count({ where: { eliminado: false } }),
    prisma.producto.count({ where: { eliminado: false } }),
    prisma.licitacion.count({
      where: { eliminado: false, fechaCreacion: { gte: hace30 }, ...licitacionFiltroBase },
    }),
    prisma.licitacion.count({
      where: {
        eliminado: false,
        fechaCreacion: { gte: hace60, lt: hace30 },
        ...licitacionFiltroBase,
      },
    }),
    prisma.proveedor.count({ where: { eliminado: false, createdAt: { gte: hace30 } } }),
    prisma.proveedor.count({
      where: { eliminado: false, createdAt: { gte: hace60, lt: hace30 } },
    }),
    prisma.producto.count({ where: { eliminado: false, createdAt: { gte: hace30 } } }),
    prisma.producto.count({
      where: { eliminado: false, createdAt: { gte: hace60, lt: hace30 } },
    }),
    prisma.licitacion.findMany({
      where: { eliminado: false, fechaCreacion: { gte: hace6Meses }, ...licitacionFiltroBase },
      select: { fechaCreacion: true },
    }),
  ]);

  const chartData: LicitacionesPorMesPunto[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    const total = licitacionesParaChart.filter(
      (l: any) =>
        l.fechaCreacion.getFullYear() === d.getFullYear() &&
        l.fechaCreacion.getMonth() === d.getMonth()
    ).length;
    return { mes: label.charAt(0).toUpperCase() + label.slice(1).replace(".", ""), total };
  });

  const metricas: {
    label: string;
    valor: number | string;
    subtexto: string;
    icon: React.ReactNode;
    delta: { delta: number; pct: number | null };
  }[] = [
    {
      label: "Licitaciones activas",
      valor: licitacionesActivas,
      subtexto: "Programadas y en proceso",
      icon: <IconFileInvoice className="h-6 w-6" />,
      delta: calcularDelta(licitacionesUltimos30, licitacionesPrevios30),
    },
    {
      label: "Proveedores activos",
      valor: proveedoresActivos,
      subtexto: `De un total de ${totalProveedores}`,
      icon: <IconUsers className="h-6 w-6" />,
      delta: calcularDelta(proveedoresUltimos30, proveedoresPrevios30),
    },
    {
      label: "Productos en catálogo",
      valor: totalProductos,
      subtexto: "Items disponibles",
      icon: <IconBox className="h-6 w-6" />,
      delta: calcularDelta(productosUltimos30, productosPrevios30),
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
      <PageTitle title="Panel de Comprador" />
      <p className="mt-1 text-sm text-zinc-500">
        Resumen general de tu actividad de compras
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {metricas.map((m) => (
          <div
            key={m.label}
            className="relative rounded-card border border-border bg-white p-5 shadow-card"
          >
            <div className="absolute top-5 right-5 text-primary/60">{m.icon}</div>
            <p className="pr-8 text-xs font-medium tracking-wide text-zinc-400 uppercase">
              {m.label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-zinc-800">{m.valor}</p>
            <p className="mt-1 text-xs text-zinc-400">{m.subtexto}</p>
            {m.delta.delta !== 0 ? (
              <p
                className={`mt-2 flex items-center gap-1 text-xs font-medium ${
                  m.delta.delta > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {m.delta.delta > 0 ? (
                  <IconArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <IconArrowDownRight className="h-3.5 w-3.5" />
                )}
                {m.delta.delta > 0 ? "+" : ""}
                {m.delta.delta}
                {m.delta.pct !== null
                  ? ` (${m.delta.pct > 0 ? "+" : ""}${m.delta.pct}%)`
                  : ""}{" "}
                vs. período anterior
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">Sin cambios vs. período anterior</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-card border border-border bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-zinc-900">Licitaciones por mes</h2>
        <p className="mt-0.5 text-xs text-zinc-400">Últimos 6 meses</p>
        <div className="mt-3">
          <LicitacionesPorMesChart data={chartData} />
        </div>
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
