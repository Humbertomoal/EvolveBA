"use client";

import {
  IconBox,
  IconBriefcase,
  IconCpu,
  IconHammer,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconPlus,
  IconRuler,
  IconSearch,
  IconTool,
  IconTools,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Producto, TipoItem } from "@/src/data/productos";
import PanelFiltros from "@/app/_components/PanelFiltros";
import type { SeccionFiltroConfig } from "@/app/_components/PanelFiltros";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import Badge from "@/src/components/Badge";
import EmptyState from "@/src/components/EmptyState";

type Vista = "galeria" | "tabla";

export default function ProductosGaleria({
  productos,
  basePath,
}: {
  productos: Producto[];
  basePath: string;
}) {
  usePageTitle("Catálogo de Productos");
  const [vista, setVista] = useState<Vista>("galeria");
  const [busqueda, setBusqueda] = useState("");

  const [tiposActivos, setTiposActivos] = useState<string[]>([]);
  const [familiasActivas, setFamiliasActivas] = useState<string[]>([]);
  const [unidadesActivas, setUnidadesActivas] = useState<string[]>([]);

  const familias = useMemo(
    () =>
      [...new Set(productos.flatMap((p) => (p.familia ? [p.familia] : [])))].sort(),
    [productos]
  );

  const unidades = useMemo(
    () => [...new Set(productos.map((p: any)=> p.unidadMedida))].sort(),
    [productos]
  );

  function toggleTipo(value: string) {
    setTiposActivos((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function toggleFamilia(value: string) {
    setFamiliasActivas((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  }

  function toggleUnidad(value: string) {
    setUnidadesActivas((prev) =>
      prev.includes(value) ? prev.filter((u) => u !== value) : [...prev, value]
    );
  }

  function limpiarFiltros() {
    setTiposActivos([]);
    setFamiliasActivas([]);
    setUnidadesActivas([]);
  }

  const secciones: SeccionFiltroConfig[] = [
    {
      titulo: "Tipo de Item",
      opciones: [
        { label: "Producto", value: "Producto" },
        { label: "Servicio", value: "Servicio" },
      ],
      seleccionados: tiposActivos,
      onToggle: toggleTipo,
    },
    ...(familias.length > 0
      ? [
          {
            titulo: "Familia",
            opciones: familias.map((f) => ({ label: f, value: f })),
            seleccionados: familiasActivas,
            onToggle: toggleFamilia,
          } satisfies SeccionFiltroConfig,
        ]
      : []),
    {
      titulo: "Unidad de Medida",
      opciones: unidades.map((u) => ({ label: u, value: u })),
      seleccionados: unidadesActivas,
      onToggle: toggleUnidad,
    },
  ];

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter((producto) => {
      const coincideTexto =
        texto === "" || producto.nombre.toLowerCase().includes(texto);
      const coincideTipo =
        tiposActivos.length === 0 || tiposActivos.includes(producto.tipoItem);
      const coincideFamilia =
        familiasActivas.length === 0 ||
        (producto.familia != null && familiasActivas.includes(producto.familia));
      const coincideUnidad =
        unidadesActivas.length === 0 ||
        unidadesActivas.includes(producto.unidadMedida);
      return coincideTexto && coincideTipo && coincideFamilia && coincideUnidad;
    });
  }, [productos, busqueda, tiposActivos, familiasActivas, unidadesActivas]);

  return (
    <div className="space-y-6">
      {/* Barra superior */}
      <div className="flex items-center gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre del material..."
            className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <PanelFiltros secciones={secciones} onLimpiar={limpiarFiltros} />

        {/* Toggle de vista */}
        <div className="flex divide-x divide-zinc-300 overflow-hidden rounded-md border border-zinc-300">
          <button
            type="button"
            title="Vista galería"
            onClick={() => setVista("galeria")}
            className={`px-2.5 py-2 transition-all duration-150 ${
              vista === "galeria"
                ? "bg-zinc-100 text-zinc-700"
                : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
          >
            <IconLayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Vista tabla"
            onClick={() => setVista("tabla")}
            className={`px-2.5 py-2 transition-all duration-150 ${
              vista === "tabla"
                ? "bg-zinc-100 text-zinc-700"
                : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
          >
            <IconList className="h-4 w-4" />
          </button>
        </div>

        {/* Agregar producto */}
        <Link
          href={`${basePath}/comprador/catalogo/nuevo`}
          className="flex items-center gap-2 rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150"
        >
          <IconPlus className="h-4 w-4" />
          Agregar producto
        </Link>
      </div>

      {/* Contenido */}
      {vista === "galeria" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {productosFiltrados.map((producto) => (
            <TarjetaProducto
              key={producto.id}
              producto={producto}
              basePath={basePath}
            />
          ))}
          {productosFiltrados.length === 0 && (
            <div className="col-span-full">
              {productos.length === 0 ? (
                <EmptyState
                  icon="IconBox"
                  title="Aún no tienes productos en el catálogo"
                  description="Agrega tu primer producto para empezar a incluirlo en licitaciones."
                />
              ) : (
                <EmptyState
                  icon="IconSearchOff"
                  title="Sin resultados"
                  description="No se encontraron productos con los filtros aplicados."
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <TablaProductos productos={productosFiltrados} basePath={basePath} />
      )}
    </div>
  );
}

/* ─── Galería ─────────────────────────────────────────────────────────────── */

const ICONOS_FAMILIA: Record<string, typeof IconBox> = {
  ti: IconCpu,
  manufactura: IconTools,
  servicios: IconBriefcase,
  construccion: IconHammer,
  equipamiento: IconTool,
};

function getIconoFamilia(familia?: string) {
  if (!familia) return IconBox;
  const key = familia
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return ICONOS_FAMILIA[key] ?? IconBox;
}

function TarjetaProducto({
  producto,
  basePath,
}: {
  producto: Producto;
  basePath: string;
}) {
  const IconoFamilia = getIconoFamilia(producto.familia);

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-white shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square bg-zinc-50">
        {producto.imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <IconoFamilia className="h-12 w-12 text-zinc-300" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-800">
          {producto.nombre}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            {producto.codigo}
          </span>
          {producto.familia && <Badge variant="neutral">{producto.familia}</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <IconRuler className="h-3.5 w-3.5" />
            {producto.unidadMedida}
          </span>
          <Link
            href={`${basePath}/comprador/catalogo/${producto.id}/editar`}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label={`Editar ${producto.nombre}`}
          >
            <IconPencil className="h-3.5 w-3.5" />
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Tabla ───────────────────────────────────────────────────────────────── */

function TablaProductos({
  productos,
  basePath,
}: {
  productos: Producto[];
  basePath: string;
}) {
  return (
    <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre del Producto</th>
              <th className="px-4 py-3 font-medium">Familia</th>
              <th className="px-4 py-3 font-medium">Unidad de Medida</th>
              <th className="px-4 py-3 font-medium">Tipo de Item</th>
              <th className="px-4 py-3 font-medium">Fecha de Creación</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {productos.map((producto) => (
              <tr key={producto.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                <td className="px-4 py-3 text-zinc-700">{producto.codigo}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{producto.nombre}</p>
                  {producto.descripcion && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                      {producto.descripcion}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {producto.familia ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {producto.unidadMedida}
                </td>
                <td className="px-4 py-3">
                  <BadgeTipoItem tipo={producto.tipoItem} />
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {producto.createdAt ? formatearFecha(producto.createdAt) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${basePath}/comprador/catalogo/${producto.id}/editar`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150"
                    aria-label={`Editar ${producto.nombre}`}
                  >
                    <IconPencil className="h-4 w-4" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2">
                  <EmptyState
                    icon="IconSearchOff"
                    title="Sin resultados"
                    description="No se encontraron productos con los filtros aplicados."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function BadgeTipoItem({ tipo }: { tipo: TipoItem }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        tipo === "Producto"
          ? "bg-blue-50 text-blue-700"
          : "bg-purple-50 text-purple-700"
      }`}
    >
      {tipo}
    </span>
  );
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
