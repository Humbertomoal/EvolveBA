"use client";

import {
  IconCircleCheck,
  IconCircleX,
  IconPackage,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Producto } from "@/src/data/productos";
import type { Proveedor } from "@/src/data/proveedores";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import {
  quitarMaterialProveedorAction,
  sincronizarMaterialesAction,
} from "@/src/lib/proveedorMaterialesActions";

const BTN_PRIMARIO =
  "rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors disabled:opacity-60";

const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors";

export default function CatalogoView({
  basePath,
  proveedor,
  productos,
  materialesAsignados,
}: {
  basePath: string;
  proveedor: Proveedor;
  productos: Producto[];
  materialesAsignados: Producto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  usePageTitle("Mi Catálogo y Mi Información");

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroFamilia, setFiltroFamilia] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [selTemp, setSelTemp] = useState<string[]>([]);

  const asignadosIds = materialesAsignados.map((m) => m.id);

  const familias = [...new Set(productos.map((p: any)=> p.familia).filter(Boolean) as string[])].sort();
  const unidades = [...new Set(productos.map((p: any)=> p.unidadMedida))].sort();

  function abrirModal() {
    setSelTemp([...asignadosIds]);
    setBusqueda("");
    setFiltroFamilia("");
    setFiltroTipo("");
    setFiltroUnidad("");
    setModalAbierto(true);
  }

  const productosFiltrados = productos.filter((p: any) => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
    const matchFamilia = !filtroFamilia || p.familia === filtroFamilia;
    const matchTipo = !filtroTipo || p.tipoItem === filtroTipo;
    const matchUnidad = !filtroUnidad || p.unidadMedida === filtroUnidad;
    return matchQ && matchFamilia && matchTipo && matchUnidad;
  });

  function toggleTemp(id: string) {
    setSelTemp((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function seleccionarTodos() {
    setSelTemp(productosFiltrados.map((p: any)=> p.id));
  }

  function deseleccionarTodos() {
    const filtradosIds = productosFiltrados.map((p: any)=> p.id);
    setSelTemp((prev) => prev.filter((id) => !filtradosIds.includes(id)));
  }

  function confirmar() {
    startTransition(async () => {
      await sincronizarMaterialesAction(proveedor.id, selTemp, basePath);
      setModalAbierto(false);
      router.refresh();
    });
  }

  function quitarMaterial(productoId: string) {
    startTransition(async () => {
      await quitarMaterialProveedorAction(proveedor.id, productoId, basePath);
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl space-y-10">
      {/* ── Sección A: Mi Información ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Mi Información</h2>

        <div className="bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* Columna izquierda */}
            <div className="divide-y divide-zinc-100">
              <InfoFila label="Razón Social" valor={proveedor.razonSocial} />
              <InfoFila
                label="Vendedor"
                valor={proveedor.vendedorNombre || "—"}
              />
              <InfoFila
                label="Celular del Vendedor"
                valor={proveedor.vendedorCelular || "—"}
              />
              <InfoFila
                label="Correo del Vendedor"
                valor={proveedor.vendedorCorreo || "—"}
              />
              <InfoFila label="RFC" valor={proveedor.rfc} />
              <InfoFila label="Tipo de Persona" valor={proveedor.tipoPersona === "Moral" ? "Moral" : "Física"} />
            </div>

            {/* Columna derecha */}
            <div className="divide-y divide-zinc-100">
              <InfoFila
                label="Nombre Contacto Admin"
                valor={proveedor.contactoAdminNombre}
              />
              <InfoFila
                label="Teléfono Contacto Admin"
                valor={proveedor.contactoAdminTelefono || "—"}
              />
              <InfoFila
                label="Correo Contacto Admin"
                valor={proveedor.contactoAdminCorreo}
              />
              <InfoFila label="Domicilio" valor={proveedor.domicilio} />
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-zinc-500">Estado</span>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    proveedor.estado === "Activo"
                      ? "bg-green-50 text-green-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {proveedor.estado === "Activo" ? (
                    <IconCircleCheck className="h-3.5 w-3.5" />
                  ) : (
                    <IconCircleX className="h-3.5 w-3.5" />
                  )}
                  {proveedor.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sección B: Mis Materiales ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Mis Materiales</h2>
          <button
            type="button"
            onClick={abrirModal}
            disabled={pending}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            <IconPackage className="h-4 w-4" />
            Agregar material
          </button>
        </div>

        {materialesAsignados.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
            Aún no tienes materiales en tu catálogo. Usa el botón para agregar.
          </p>
        ) : (
          <div className="overflow-x-auto bg-white border border-[#ede8e8] rounded-[10px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Unidad de Medida</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {materialesAsignados.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-medium text-zinc-800">
                      {m.nombre}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{m.codigo}</td>
                    <td className="px-4 py-3 text-zinc-500">{m.unidadMedida}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => quitarMaterial(m.id)}
                        disabled={pending}
                        aria-label={`Quitar ${m.nombre}`}
                        className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Modal: Agregar materiales ─────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
            style={{ maxHeight: "85vh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                Seleccionar materiales
              </h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {/* Search + Filters */}
            <div className="shrink-0 space-y-2 border-b border-zinc-200 px-5 py-3">
              <input
                type="text"
                placeholder="Buscar por nombre o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={filtroFamilia}
                  onChange={(e) => setFiltroFamilia(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="">Familia: Todas</option>
                  {familias.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="">Tipo: Todos</option>
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                </select>
                <select
                  value={filtroUnidad}
                  onChange={(e) => setFiltroUnidad(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none"
                >
                  <option value="">Unidad: Todas</option>
                  {unidades.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select all / Deselect all */}
            <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-5 py-2">
              <button
                type="button"
                onClick={seleccionarTodos}
                className="text-xs font-medium text-[var(--color-primario)] hover:underline"
              >
                Seleccionar todos
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                onClick={deseleccionarTodos}
                className="text-xs font-medium text-zinc-500 hover:underline"
              >
                Deseleccionar todos
              </button>
            </div>

            {/* List */}
            <div
              className="flex-1 overflow-y-auto px-5 py-1"
              style={{ minHeight: 0 }}
            >
              {productosFiltrados.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">
                  Sin resultados
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {productosFiltrados.map((p: any)=> (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selTemp.includes(p.id)}
                          onChange={() => toggleTemp(p.id)}
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-800">
                            {p.nombre}
                          </span>
                          <span className="ml-2 text-xs text-zinc-400">
                            {p.codigo}
                          </span>
                        </span>
                        <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                          {p.unidadMedida}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-5 py-4">
              <span className="text-sm text-zinc-500">
                {selTemp.length === 0
                  ? "Ningún material seleccionado"
                  : `${selTemp.length} material${selTemp.length !== 1 ? "es" : ""} seleccionado${selTemp.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={pending}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={pending}
                  className={BTN_PRIMARIO}
                >
                  {pending ? "Guardando…" : "Confirmar selección"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoFila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-xs font-medium text-zinc-500">{label}</span>
      <span className="text-right text-sm text-zinc-800">{valor}</span>
    </div>
  );
}
