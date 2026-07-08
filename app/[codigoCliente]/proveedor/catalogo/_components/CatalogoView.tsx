"use client";

import {
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconPackage,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Producto } from "@/src/data/productos";
import type { Proveedor } from "@/src/data/proveedores";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import EmptyState from "@/src/components/EmptyState";
import {
  quitarMaterialProveedorAction,
  sincronizarMaterialesAction,
} from "@/src/lib/proveedorMaterialesActions";

const BTN_PRIMARIO =
  "rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150 disabled:opacity-60";

const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors";

const ESTADOS_INLINE = [
  { value: "todos", label: "Todos" },
  { value: "mis", label: "Mis materiales" },
  { value: "disponibles", label: "Disponibles" },
] as const;

type EstadoInline = (typeof ESTADOS_INLINE)[number]["value"];

export default function CatalogoView({
  basePath,
  proveedor,
  productos,
  materialesAsignados,
  familiasCatalogo = [],
  familiasProveedor = [],
}: {
  basePath: string;
  proveedor: Proveedor;
  productos: Producto[];
  materialesAsignados: Producto[];
  familiasCatalogo?: { codigo: string; nombre: string }[];
  familiasProveedor?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  usePageTitle("Mi Catálogo y Mi Información");

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroFamilias, setFiltroFamilias] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [selTemp, setSelTemp] = useState<string[]>([]);
  const [familiasAsignadas, setFamiliasAsignadas] = useState<string[]>(familiasProveedor);
  const [familiaDropdownAbierto, setFamiliaDropdownAbierto] = useState(false);
  const [familiaDropdownTemp, setFamiliaDropdownTemp] = useState<string[]>([]);
  const familiaDropdownRef = useRef<HTMLDivElement>(null);
  const familiaBotonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!familiaDropdownAbierto) return;
    function handleClick(e: MouseEvent) {
      if (
        familiaDropdownRef.current &&
        !familiaDropdownRef.current.contains(e.target as Node) &&
        familiaBotonRef.current &&
        !familiaBotonRef.current.contains(e.target as Node)
      ) {
        setFamiliaDropdownAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [familiaDropdownAbierto]);

  const asignadosIds = materialesAsignados.map((m) => m.id);

  // Inline editor state for "Mis Materiales" when the comprador assigned
  // families: every catalog product in an assigned family is toggleable,
  // pre-checked for whatever is already in ProveedorMaterial.
  const [seleccionInline, setSeleccionInline] = useState<string[]>(asignadosIds);

  const productosPorFamiliaAsignada = familiasAsignadas.map((familia) => ({
    familia,
    productos: productos.filter((p: any) => p.familia === familia),
  }));

  const idsEnAlcanceInline = new Set(
    productosPorFamiliaAsignada.flatMap((g) => g.productos.map((p: any) => p.id))
  );

  function toggleInline(id: string) {
    setSeleccionInline((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function guardarInline() {
    // Materials outside the assigned families' scope (if any) are left untouched.
    const fueraDeAlcance = asignadosIds.filter((id) => !idsEnAlcanceInline.has(id));
    const payload = [...new Set([...fueraDeAlcance, ...seleccionInline])];
    startTransition(async () => {
      await sincronizarMaterialesAction(proveedor.id, payload, basePath, familiasAsignadas);
      router.refresh();
    });
  }

  // ── Search/filter/collapse controls for the inline "Mis Materiales" editor ────
  const [busquedaInline, setBusquedaInline] = useState("");
  const [filtroEstadoInline, setFiltroEstadoInline] = useState<EstadoInline>("todos");
  const [filtroFamiliasInline, setFiltroFamiliasInline] = useState<string[]>([]);
  const [familiasColapsadas, setFamiliasColapsadas] = useState<Set<string>>(() => {
    const inicial = new Set<string>();
    for (const { familia, productos: productosFamilia } of productosPorFamiliaAsignada) {
      if (productosFamilia.length > 5) inicial.add(familia);
    }
    return inicial;
  });

  function toggleColapsar(familia: string) {
    setFamiliasColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(familia)) next.delete(familia);
      else next.add(familia);
      return next;
    });
  }

  const productosPorFamiliaFiltrados = productosPorFamiliaAsignada
    .filter(
      ({ familia }) => filtroFamiliasInline.length === 0 || filtroFamiliasInline.includes(familia)
    )
    .map(({ familia, productos: productosFamilia }) => {
      const q = busquedaInline.toLowerCase();
      const filtrados = productosFamilia.filter((p: any) => {
        const matchQ = !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
        const marcado = seleccionInline.includes(p.id);
        const matchEstado =
          filtroEstadoInline === "todos" ||
          (filtroEstadoInline === "mis" && marcado) ||
          (filtroEstadoInline === "disponibles" && !marcado);
        return matchQ && matchEstado;
      });
      const seleccionados = productosFamilia.filter((p: any) => seleccionInline.includes(p.id)).length;
      return { familia, filtrados, seleccionados, total: productosFamilia.length };
    })
    .filter((g) => g.total === 0 || g.filtrados.length > 0);

  const unidades = [...new Set(productos.map((p: any)=> p.unidadMedida))].sort();

  function abrirModal() {
    setSelTemp([...asignadosIds]);
    setBusqueda("");
    setFiltroFamilias([]);
    setFiltroTipo("");
    setFiltroUnidad("");
    setFamiliaDropdownAbierto(false);
    setModalAbierto(true);
  }

  const productosFiltrados = productos.filter((p: any) => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
    const matchFamilia = filtroFamilias.length === 0 || filtroFamilias.includes(p.familia);
    const matchTipo = !filtroTipo || p.tipoItem === filtroTipo;
    const matchUnidad = !filtroUnidad || p.unidadMedida === filtroUnidad;
    return matchQ && matchFamilia && matchTipo && matchUnidad;
  });

  // Families with at least one currently-selected material — drives the
  // compact chips row below the family filter dropdown.
  const familiasConSeleccion = (() => {
    const conteos = new Map<string, number>();
    for (const id of selTemp) {
      const prod = productos.find((p: any) => p.id === id);
      if (prod?.familia) conteos.set(prod.familia, (conteos.get(prod.familia) ?? 0) + 1);
    }
    return [...conteos.entries()].map(([familia, count]) => ({ familia, count }));
  })();

  const resumenFiltroFamilias =
    filtroFamilias.length === 0
      ? "Filtrar por familia…"
      : filtroFamilias.length <= 2
        ? filtroFamilias.join(", ")
        : `${filtroFamilias.slice(0, 2).join(", ")} (+${filtroFamilias.length - 2} más)`;

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

  function abrirDropdownFamilias() {
    setFamiliaDropdownTemp([...filtroFamilias]);
    setFamiliaDropdownAbierto((v) => !v);
  }

  function toggleFamiliaDropdownTemp(nombre: string) {
    setFamiliaDropdownTemp((prev) =>
      prev.includes(nombre) ? prev.filter((f) => f !== nombre) : [...prev, nombre]
    );
  }

  function seleccionarTodasFamiliasDropdown() {
    setFamiliaDropdownTemp(familiasCatalogo.map((f) => f.nombre));
  }

  function deseleccionarTodasFamiliasDropdown() {
    setFamiliaDropdownTemp([]);
  }

  function aplicarFiltroFamilias() {
    setFiltroFamilias([...familiaDropdownTemp]);
    const idsFiltradas = productos
      .filter((p: any) => familiaDropdownTemp.includes(p.familia))
      .map((p: any) => p.id);
    setSelTemp((prev) => [...new Set([...prev, ...idsFiltradas])]);
    setFamiliaDropdownAbierto(false);
  }

  function verTodosMateriales() {
    setFiltroFamilias([]);
  }

  function quitarFamiliaDeSeleccion(familia: string) {
    const ids = productos.filter((p: any) => p.familia === familia).map((p: any) => p.id);
    setSelTemp((prev) => prev.filter((id) => !ids.includes(id)));
    setFiltroFamilias((prev) => prev.filter((f) => f !== familia));
    setFamiliaDropdownTemp((prev) => prev.filter((f) => f !== familia));
  }

  function confirmar() {
    const familiasFinal = familiasConSeleccion.map((f) => f.familia);
    startTransition(async () => {
      await sincronizarMaterialesAction(proveedor.id, selTemp, basePath, familiasFinal);
      setFamiliasAsignadas(familiasFinal);
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

        <div className="rounded-card border border-border bg-white shadow-card">
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
                <span className="text-xs text-zinc-400">Estado</span>
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
          {familiasAsignadas.length === 0 && (
            <button
              type="button"
              onClick={abrirModal}
              disabled={pending}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <IconPackage className="h-4 w-4" />
              Agregar material
            </button>
          )}
        </div>

        {familiasAsignadas.length > 0 ? (
          <div className="space-y-4">
            {/* Buscador + filtro por estado + filtro por familia */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar material…"
                value={busquedaInline}
                onChange={(e) => setBusquedaInline(e.target.value)}
                className="min-w-[180px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex rounded-md border border-zinc-300 p-0.5 text-xs">
                {ESTADOS_INLINE.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFiltroEstadoInline(value)}
                    className={`rounded px-2.5 py-1.5 font-medium transition-colors duration-150 ${
                      filtroEstadoInline === value
                        ? "bg-[var(--color-primario)] text-white"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <FamiliaDropdown
                familias={familiasCatalogo.filter((f) => familiasAsignadas.includes(f.nombre))}
                seleccionadas={filtroFamiliasInline}
                onAplicar={setFiltroFamiliasInline}
              />
            </div>

            {productosPorFamiliaFiltrados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400">
                Sin resultados para tu búsqueda.
              </p>
            ) : (
              <div className="space-y-6">
                {productosPorFamiliaFiltrados.map(({ familia, filtrados, seleccionados, total }) => {
                  const colapsada = familiasColapsadas.has(familia);
                  return (
                    <div key={familia} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleColapsar(familia)}
                        className="flex w-full items-center gap-1.5 text-left"
                      >
                        {colapsada ? (
                          <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        ) : (
                          <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        )}
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {familia} ({seleccionados} de {total} seleccionados)
                        </h3>
                      </button>
                      {!colapsada && (
                        total === 0 ? (
                          <p className="rounded-lg border border-dashed border-zinc-300 py-4 text-center text-xs text-zinc-400">
                            Sin productos en esta familia.
                          </p>
                        ) : (
                          <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                                    <th className="w-10 px-4 py-2.5" />
                                    <th className="px-4 py-2.5">Nombre</th>
                                    <th className="px-4 py-2.5">Código</th>
                                    <th className="px-4 py-2.5">Unidad de Medida</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {filtrados.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                                      <td className="px-4 py-3">
                                        <label
                                          className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-colors duration-150 ${
                                            seleccionInline.includes(p.id)
                                              ? "border-primary bg-primary/10"
                                              : "border-zinc-300 bg-white hover:bg-zinc-50"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={seleccionInline.includes(p.id)}
                                            onChange={() => toggleInline(p.id)}
                                            className="sr-only"
                                          />
                                          {seleccionInline.includes(p.id) && (
                                            <IconCheck className="h-3.5 w-3.5 text-primary" />
                                          )}
                                        </label>
                                      </td>
                                      <td className="px-4 py-3 font-medium text-zinc-800">{p.nombre}</td>
                                      <td className="px-4 py-3 text-zinc-500">{p.codigo}</td>
                                      <td className="px-4 py-3 text-zinc-500">{p.unidadMedida}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" onClick={guardarInline} disabled={pending} className={BTN_PRIMARIO}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        ) : materialesAsignados.length === 0 ? (
          <EmptyState
            icon="IconPackage"
            title="Aún no tienes materiales asignados"
            description="Usa el botón «Agregar material» para elegir los productos que ofreces."
            actionLabel="Agregar material"
            onAction={abrirModal}
          />
        ) : (
          <MaterialesTabla materiales={materialesAsignados} onQuitar={quitarMaterial} pending={pending} />
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
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tipo: Todos</option>
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                </select>
                <select
                  value={filtroUnidad}
                  onChange={(e) => setFiltroUnidad(e.target.value)}
                  className="flex-1 min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Unidad: Todas</option>
                  {unidades.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtrar por familia */}
            {familiasCatalogo.length > 0 && (
              <div className="shrink-0 space-y-2 border-b border-zinc-100 px-5 py-3">
                <div className="relative">
                  <button
                    ref={familiaBotonRef}
                    type="button"
                    onClick={abrirDropdownFamilias}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-xs focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <span className={filtroFamilias.length === 0 ? "text-zinc-400" : "text-zinc-700"}>
                      {resumenFiltroFamilias}
                    </span>
                    <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  </button>

                  {familiaDropdownAbierto && (
                    <div
                      ref={familiaDropdownRef}
                      className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg"
                    >
                      <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={seleccionarTodasFamiliasDropdown}
                          className="text-xs font-medium text-[var(--color-primario)] hover:underline"
                        >
                          Seleccionar todas
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          type="button"
                          onClick={deseleccionarTodasFamiliasDropdown}
                          className="text-xs font-medium text-zinc-500 hover:underline"
                        >
                          Deseleccionar todas
                        </button>
                      </div>
                      <div className="max-h-44 overflow-y-auto p-2">
                        {familiasCatalogo.map((f) => (
                          <label
                            key={f.codigo}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={familiaDropdownTemp.includes(f.nombre)}
                              onChange={() => toggleFamiliaDropdownTemp(f.nombre)}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            {f.nombre}
                          </label>
                        ))}
                      </div>
                      <div className="border-t border-zinc-100 p-2">
                        <button
                          type="button"
                          onClick={aplicarFiltroFamilias}
                          className="w-full rounded-md bg-[var(--color-primario)] py-1.5 text-xs font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {filtroFamilias.length > 0 && (
                  <button
                    type="button"
                    onClick={verTodosMateriales}
                    className="text-xs font-medium text-zinc-500 hover:underline"
                  >
                    Ver todos los materiales
                  </button>
                )}

                {familiasConSeleccion.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {familiasConSeleccion.map(({ familia, count }) => (
                      <span
                        key={familia}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {familia}
                        <span className="text-zinc-400">
                          ({count} material{count !== 1 ? "es" : ""})
                        </span>
                        <button
                          type="button"
                          onClick={() => quitarFamiliaDeSeleccion(familia)}
                          aria-label={`Quitar familia ${familia}`}
                          className="text-zinc-400 hover:text-zinc-700"
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

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
      <span className="shrink-0 text-xs text-zinc-400">{label}</span>
      <span className="text-right text-sm font-medium text-zinc-800">{valor}</span>
    </div>
  );
}

function FamiliaDropdown({
  familias,
  seleccionadas,
  onAplicar,
}: {
  familias: { codigo: string; nombre: string }[];
  seleccionadas: string[];
  onAplicar: (nombres: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [temp, setTemp] = useState<string[]>(seleccionadas);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        botonRef.current &&
        !botonRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [abierto]);

  function abrir() {
    setTemp([...seleccionadas]);
    setAbierto((v) => !v);
  }

  function toggle(nombre: string) {
    setTemp((prev) =>
      prev.includes(nombre) ? prev.filter((f) => f !== nombre) : [...prev, nombre]
    );
  }

  const resumen =
    seleccionadas.length === 0
      ? "Todas las familias"
      : seleccionadas.length <= 2
        ? seleccionadas.join(", ")
        : `${seleccionadas.slice(0, 2).join(", ")} (+${seleccionadas.length - 2} más)`;

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={abrir}
        className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-xs focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <span className={seleccionadas.length === 0 ? "text-zinc-500" : "text-zinc-700"}>{resumen}</span>
        <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>

      {abierto && (
        <div
          ref={panelRef}
          className="absolute z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2">
            <button
              type="button"
              onClick={() => setTemp(familias.map((f) => f.nombre))}
              className="text-xs font-medium text-[var(--color-primario)] hover:underline"
            >
              Seleccionar todas
            </button>
            <span className="text-zinc-300">|</span>
            <button
              type="button"
              onClick={() => setTemp([])}
              className="text-xs font-medium text-zinc-500 hover:underline"
            >
              Deseleccionar todas
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto p-2">
            {familias.map((f) => (
              <label
                key={f.codigo}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={temp.includes(f.nombre)}
                  onChange={() => toggle(f.nombre)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                {f.nombre}
              </label>
            ))}
          </div>
          <div className="border-t border-zinc-100 p-2">
            <button
              type="button"
              onClick={() => {
                onAplicar(temp);
                setAbierto(false);
              }}
              className="w-full rounded-md bg-[var(--color-primario)] py-1.5 text-xs font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialesTabla({
  materiales,
  onQuitar,
  pending,
}: {
  materiales: Producto[];
  onQuitar: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Unidad de Medida</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {materiales.map((m) => (
              <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                <td className="px-4 py-3 font-medium text-zinc-800">{m.nombre}</td>
                <td className="px-4 py-3 text-zinc-500">{m.codigo}</td>
                <td className="px-4 py-3 text-zinc-500">{m.unidadMedida}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onQuitar(m.id)}
                    disabled={pending}
                    aria-label={`Quitar ${m.nombre}`}
                    className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
