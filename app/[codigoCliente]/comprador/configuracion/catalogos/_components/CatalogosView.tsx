"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import toast from "react-hot-toast";
import type { CatalogoValorDTO } from "@/src/lib/getCatalogos";
import {
  crearCatalogoValorAction,
  actualizarCatalogoValorAction,
  eliminarCatalogoValorAction,
  toggleActivoCatalogoValorAction,
  actualizarOrdenAction,
} from "@/src/lib/catalogosActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import EmptyState from "@/src/components/EmptyState";

type TabKey = "JERARQUIA" | "TIPO_LICITACION" | "FAMILIA" | "UNIDAD_MEDIDA" | "MONEDA";

const TABS: { key: TabKey; label: string }[] = [
  { key: "JERARQUIA", label: "Criticidad" },
  { key: "TIPO_LICITACION", label: "Tipos de Licitación" },
  { key: "FAMILIA", label: "Familias de Producto" },
  { key: "UNIDAD_MEDIDA", label: "Unidades de Medida" },
  { key: "MONEDA", label: "Monedas" },
];

function tabDesdeParam(v: string | null): TabKey {
  return TABS.some((t) => t.key === v) ? (v as TabKey) : "JERARQUIA";
}

type ModalState =
  | { open: false }
  | { open: true; modo: "crear"; tipo: TabKey }
  | { open: true; modo: "editar"; valor: CatalogoValorDTO };

export default function CatalogosView({
  valores,
  clienteId,
}: {
  valores: CatalogoValorDTO[];
  clienteId: string;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  usePageTitle("Catálogo de Valores");
  const [tab, setTab] = useState<TabKey>(() => tabDesdeParam(searchParams.get("tab")));
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Modal form state
  const [formCodigo, setFormCodigo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formSimbolo, setFormSimbolo] = useState("");
  const [formActivo, setFormActivo] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const tabValores = valores
    .filter((v) => v.tipo === tab)
    .sort((a: any, b: any) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  const esMonedaTab = tab === "MONEDA";
  const esMonedaModal =
    modal.open &&
    (modal.modo === "crear" ? modal.tipo === "MONEDA" : modal.valor.tipo === "MONEDA");

  function cambiarTab(key: TabKey) {
    setTab(key);
    setBannerError(null);
    setConfirmandoId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function abrirCrear() {
    setFormCodigo("");
    setFormNombre("");
    setFormSimbolo("");
    setFormActivo(true);
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "crear", tipo: tab });
  }

  function abrirEditar(valor: CatalogoValorDTO) {
    setFormNombre(valor.nombre);
    setFormSimbolo(valor.simbolo ?? "");
    setFormActivo(valor.activo);
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "editar", valor });
  }

  function cerrarModal() {
    setModal({ open: false });
    setFormError(null);
  }

  async function handleGuardar() {
    if (modal.open && modal.modo === "crear" && !formCodigo.trim()) {
      setFormError("El código es requerido.");
      return;
    }
    if (!formNombre.trim()) {
      setFormError("El nombre es requerido.");
      return;
    }
    setFormError(null);
    setCargando(true);

    const datos = {
      nombre: formNombre.trim(),
      simbolo: esMonedaModal ? formSimbolo.trim() || null : null,
      activo: formActivo,
    };

    if (!modal.open) {
      setCargando(false);
      return;
    }

    let result: { ok: boolean; error?: string };
    if (modal.modo === "crear") {
      result = await crearCatalogoValorAction(modal.tipo, clienteId, {
        ...datos,
        codigo: formCodigo.trim(),
      });
    } else {
      result = await actualizarCatalogoValorAction(modal.valor.id, datos);
    }

    setCargando(false);
    if (!result.ok) {
      setFormError(result.error ?? "Error al guardar.");
      toast.error(result.error ?? "No se pudo guardar el valor.");
      return;
    }
    toast.success(
      modal.modo === "crear" ? "Valor creado correctamente" : "Valor actualizado correctamente"
    );
    cerrarModal();
    router.refresh();
  }

  async function handleToggleActivo(id: string, activo: boolean) {
    await toggleActivoCatalogoValorAction(id, !activo);
    router.refresh();
  }

  async function handleEliminar(id: string) {
    setCargando(true);
    setBannerError(null);
    const result = await eliminarCatalogoValorAction(id);
    setCargando(false);
    setConfirmandoId(null);
    if (!result.ok) {
      setBannerError(result.error ?? "Error al eliminar.");
      toast.error(result.error ?? "No se pudo eliminar el valor.");
      return;
    }
    toast.success("Valor eliminado correctamente");
    router.refresh();
  }

  async function handleOrden(id: string, valorStr: string) {
    const orden = parseInt(valorStr);
    if (isNaN(orden)) return;
    await actualizarOrdenAction(id, orden);
    router.refresh();
  }

  const INPUT_MODAL =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-zinc-400";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Administra los valores de los campos de selección del sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => cambiarTab(key)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-all duration-150 ${
                tab === key
                  ? "border-[var(--color-primario)] text-[var(--color-primario)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {bannerError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{bannerError}</span>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="shrink-0 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <span className="text-sm font-medium text-zinc-700">
            {TABS.find((t) => t.key === tab)?.label}
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
              {tabValores.length}
            </span>
          </span>
          <button
            type="button"
            onClick={abrirCrear}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primario)] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
          >
            <IconPlus className="h-4 w-4" />
            Agregar
          </button>
        </div>

        {tabValores.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              icon="IconListDetails"
              title="Sin valores configurados"
              description={`Agrega el primer valor de "${TABS.find((t) => t.key === tab)?.label}" para empezar a usarlo en el sistema.`}
              actionLabel="Agregar"
              onAction={abrirCrear}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="w-24 px-4 py-2.5">Orden</th>
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Nombre</th>
                  {esMonedaTab && <th className="px-4 py-2.5">Símbolo</th>}
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tabValores.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        defaultValue={v.orden}
                        onBlur={(e) => {
                          if (e.target.value !== String(v.orden))
                            handleOrden(v.id, e.target.value);
                        }}
                        className="w-16 rounded border border-zinc-200 px-2 py-1 text-center text-xs focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{v.codigo}</td>
                    <td className="px-4 py-2.5 text-zinc-800">{v.nombre}</td>
                    {esMonedaTab && (
                      <td className="px-4 py-2.5 text-zinc-500">{v.simbolo ?? "—"}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(v.id, v.activo)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${
                          v.activo
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {v.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {confirmandoId === v.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-zinc-500">¿Eliminar?</span>
                          <button
                            type="button"
                            disabled={cargando}
                            onClick={() => handleEliminar(v.id)}
                            className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoId(null)}
                            className="text-zinc-400 hover:text-zinc-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditar(v)}
                            title="Editar"
                            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150"
                          >
                            <IconPencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoId(v.id)}
                            title="Eliminar"
                            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.modo === "crear" ? "Agregar valor" : "Editar valor"}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {TABS.find(
                  (t) => t.key === (modal.modo === "crear" ? modal.tipo : modal.valor.tipo)
                )?.label}
                {modal.modo === "editar" && (
                  <span className="ml-2 font-mono text-zinc-400">{modal.valor.codigo}</span>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {modal.modo === "crear" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Código <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) =>
                      setFormCodigo(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                      )
                    }
                    placeholder="Ej. ALTA"
                    maxLength={30}
                    className={INPUT_MODAL}
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Solo letras mayúsculas, números y guion bajo.
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  Código: <span className="font-mono font-medium text-zinc-700">{modal.valor.codigo}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Nombre visible en el sistema"
                  className={INPUT_MODAL}
                  autoFocus={modal.modo === "editar"}
                />
              </div>

              {esMonedaModal && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Símbolo</label>
                  <input
                    type="text"
                    value={formSimbolo}
                    onChange={(e) => setFormSimbolo(e.target.value)}
                    placeholder="Ej. $, €, £"
                    maxLength={3}
                    className={INPUT_MODAL}
                  />
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActivo}
                  onChange={(e) => setFormActivo(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700">Activo</span>
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModal}
                disabled={cargando}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                disabled={cargando}
                className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50"
              >
                {cargando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
