"use client";

import {
  IconBox,
  IconBriefcase,
  IconCpu,
  IconEye,
  IconEyeOff,
  IconHammer,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconPlus,
  IconRuler,
  IconSearch,
  IconTool,
  IconTools,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { Producto, TipoItem } from "@/src/data/productos";
import {
  eliminarProductoAction,
  getProductoUsoAction,
  toggleActivoProductoAction,
  type UsoProducto,
} from "@/src/lib/productosActions";
import PanelFiltros from "@/app/_components/PanelFiltros";
import type { SeccionFiltroConfig } from "@/app/_components/PanelFiltros";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import Badge from "@/src/components/Badge";
import EmptyState from "@/src/components/EmptyState";

type Vista = "galeria" | "tabla";

type ModalEliminar = { producto: Producto } & UsoProducto;

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
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [tiposActivos, setTiposActivos] = useState<string[]>([]);
  const [familiasActivas, setFamiliasActivas] = useState<string[]>([]);
  const [unidadesActivas, setUnidadesActivas] = useState<string[]>([]);

  // ── Activar / Inactivar / Eliminar ────────────────────────────────────────
  const [procesando, setProcesando] = useState<string | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [modalEliminar, setModalEliminar] = useState<ModalEliminar | null>(null);

  async function handleToggleActivo(producto: Producto, opts?: { skipConfirm?: boolean }) {
    const nuevoEstado = !producto.activo;
    if (!nuevoEstado && !opts?.skipConfirm) {
      if (
        !window.confirm(
          `¿Inactivar "${producto.nombre}"? No estará disponible para agregar a nuevas licitaciones.`
        )
      )
        return;
    }
    setProcesando(producto.id);
    try {
      await toggleActivoProductoAction(producto.id, nuevoEstado, basePath);
      toast.success(nuevoEstado ? "Producto activado" : "Producto inactivado");
    } catch {
      toast.error("No se pudo actualizar el producto. Intenta de nuevo.");
    } finally {
      setProcesando(null);
    }
  }

  async function handleEliminarClick(producto: Producto) {
    setVerificando(producto.id);
    try {
      const uso = await getProductoUsoAction(producto.id);
      setModalEliminar({ producto, ...uso });
    } catch {
      toast.error("No se pudo verificar el producto. Intenta de nuevo.");
    } finally {
      setVerificando(null);
    }
  }

  async function confirmarEliminar() {
    if (!modalEliminar) return;
    const { producto } = modalEliminar;
    setProcesando(producto.id);
    try {
      const res = await eliminarProductoAction(producto.id, basePath);
      if (res.ok) {
        toast.success("Producto eliminado del catálogo");
        setModalEliminar(null);
      } else {
        // Cambió de estado entre la verificación y la confirmación.
        setModalEliminar({ producto, ...res });
      }
    } catch {
      toast.error("No se pudo eliminar el producto. Intenta de nuevo.");
    } finally {
      setProcesando(null);
    }
  }

  function inactivarDesdeModalEliminar() {
    if (!modalEliminar) return;
    const { producto } = modalEliminar;
    setModalEliminar(null);
    handleToggleActivo(producto, { skipConfirm: true });
  }

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
      const coincideActivo = mostrarInactivos || producto.activo;
      return (
        coincideTexto && coincideTipo && coincideFamilia && coincideUnidad && coincideActivo
      );
    });
  }, [productos, busqueda, tiposActivos, familiasActivas, unidadesActivas, mostrarInactivos]);

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

        {/* Mostrar inactivos */}
        <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-sm text-zinc-500">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-[var(--color-primario)] focus:ring-primary/30"
          />
          Mostrar inactivos
        </label>

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
              procesando={procesando === producto.id}
              verificando={verificando === producto.id}
              onToggleActivo={() => handleToggleActivo(producto)}
              onEliminarClick={() => handleEliminarClick(producto)}
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
        <TablaProductos
          productos={productosFiltrados}
          basePath={basePath}
          procesando={procesando}
          verificando={verificando}
          onToggleActivo={handleToggleActivo}
          onEliminarClick={handleEliminarClick}
        />
      )}

      {/* Modal: eliminar producto */}
      {modalEliminar && (
        <ModalEliminarProducto
          modal={modalEliminar}
          procesando={procesando === modalEliminar.producto.id}
          onCancelar={() => setModalEliminar(null)}
          onConfirmar={confirmarEliminar}
          onInactivar={inactivarDesdeModalEliminar}
        />
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
  procesando,
  verificando,
  onToggleActivo,
  onEliminarClick,
}: {
  producto: Producto;
  basePath: string;
  procesando: boolean;
  verificando: boolean;
  onToggleActivo: () => void;
  onEliminarClick: () => void;
}) {
  const IconoFamilia = getIconoFamilia(producto.familia);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-card border border-border bg-white shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md ${
        producto.activo ? "" : "opacity-60"
      }`}
    >
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
          {!producto.activo && <Badge variant="neutral">Inactivo</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <IconRuler className="h-3.5 w-3.5" />
            {producto.unidadMedida}
          </span>
          <div className="flex items-center gap-0.5">
            <Link
              href={`${basePath}/comprador/catalogo/${producto.id}/editar`}
              className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label={`Editar ${producto.nombre}`}
              title="Editar"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onToggleActivo}
              disabled={procesando}
              className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40"
              aria-label={producto.activo ? `Inactivar ${producto.nombre}` : `Activar ${producto.nombre}`}
              title={producto.activo ? "Inactivar" : "Activar"}
            >
              {producto.activo ? (
                <IconEyeOff className="h-3.5 w-3.5" />
              ) : (
                <IconEye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onEliminarClick}
              disabled={verificando}
              className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
              aria-label={`Eliminar ${producto.nombre}`}
              title="Eliminar"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tabla ───────────────────────────────────────────────────────────────── */

function TablaProductos({
  productos,
  basePath,
  procesando,
  verificando,
  onToggleActivo,
  onEliminarClick,
}: {
  productos: Producto[];
  basePath: string;
  procesando: string | null;
  verificando: string | null;
  onToggleActivo: (producto: Producto) => void;
  onEliminarClick: (producto: Producto) => void;
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
              <tr
                key={producto.id}
                className={`hover:bg-zinc-50/50 transition-colors duration-150 ${
                  producto.activo ? "" : "opacity-60"
                }`}
              >
                <td className="px-4 py-3 text-zinc-700">{producto.codigo}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-zinc-900">{producto.nombre}</p>
                    {!producto.activo && <Badge variant="neutral">Inactivo</Badge>}
                  </div>
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
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`${basePath}/comprador/catalogo/${producto.id}/editar`}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150"
                      aria-label={`Editar ${producto.nombre}`}
                      title="Editar"
                    >
                      <IconPencil className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onToggleActivo(producto)}
                      disabled={procesando === producto.id}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150 disabled:opacity-40"
                      aria-label={producto.activo ? `Inactivar ${producto.nombre}` : `Activar ${producto.nombre}`}
                      title={producto.activo ? "Inactivar" : "Activar"}
                    >
                      {producto.activo ? (
                        <IconEyeOff className="h-4 w-4" />
                      ) : (
                        <IconEye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEliminarClick(producto)}
                      disabled={verificando === producto.id}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-150 disabled:opacity-40"
                      aria-label={`Eliminar ${producto.nombre}`}
                      title="Eliminar"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
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

/* ─── Modal: eliminar producto ───────────────────────────────────────────── */

function ModalEliminarProducto({
  modal,
  procesando,
  onCancelar,
  onConfirmar,
  onInactivar,
}: {
  modal: ModalEliminar;
  procesando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
  onInactivar: () => void;
}) {
  const { producto, enUso, licitaciones, proveedores } = modal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            {enUso ? "No se puede eliminar" : "Eliminar producto"}
          </h2>
          <button
            type="button"
            onClick={onCancelar}
            className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {enUso ? (
          <p className="mt-3 text-sm text-zinc-600">
            Este producto no se puede eliminar porque está siendo usado en{" "}
            <span className="font-semibold text-zinc-900">{licitaciones}</span>{" "}
            licitacion{licitaciones === 1 ? "" : "es"} y/o asignado a{" "}
            <span className="font-semibold text-zinc-900">{proveedores}</span>{" "}
            proveedor{proveedores === 1 ? "" : "es"}. Puedes inactivarlo en su lugar.
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            ¿Eliminar <span className="font-medium text-zinc-900">{producto.nombre}</span>?
            Esta acción lo quitará del catálogo.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          {enUso ? (
            <button
              type="button"
              onClick={onInactivar}
              className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
            >
              Inactivar en su lugar
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmar}
              disabled={procesando}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700 disabled:opacity-60"
            >
              {procesando ? "Eliminando…" : "Eliminar"}
            </button>
          )}
        </div>
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
