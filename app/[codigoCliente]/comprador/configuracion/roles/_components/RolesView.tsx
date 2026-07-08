"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { MODULOS, type RolDTO, type RolPermisoDTO } from "@/src/lib/usuariosTypes";
import {
  crearRolAction,
  actualizarRolAction,
  eliminarRolAction,
} from "@/src/lib/usuariosActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import EmptyState from "@/src/components/EmptyState";

// ── Permission helpers ────────────────────────────────────────────────────────

type PermisoForm = {
  modulo: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

function buildPermisosForm(permisos: RolPermisoDTO[]): PermisoForm[] {
  return MODULOS.map((m) => {
    const existing = permisos.find((p: any)  => p.modulo === m.key);
    return existing
      ? { modulo: m.key, ver: existing.ver, crear: existing.crear, editar: existing.editar, eliminar: existing.eliminar }
      : { modulo: m.key, ver: false, crear: false, editar: false, eliminar: false };
  });
}

// ── Permission matrix ─────────────────────────────────────────────────────────

function MatrizPermisos({
  permisos,
  disabled,
  onChange,
}: {
  permisos: PermisoForm[];
  disabled: boolean;
  onChange: (modulo: string, campo: "ver" | "crear" | "editar" | "eliminar", valor: boolean) => void;
}) {
  return (
    <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
              <th className="px-3 py-2.5">Módulo</th>
              <th className="px-3 py-2.5 text-center">Ver</th>
              <th className="px-3 py-2.5 text-center">Crear</th>
              <th className="px-3 py-2.5 text-center">Editar</th>
              <th className="px-3 py-2.5 text-center">Eliminar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {MODULOS.map((m) => {
              const p = permisos.find((p: any)  => p.modulo === m.key) ?? {
                modulo: m.key, ver: false, crear: false, editar: false, eliminar: false,
              };
              return (
                <tr key={m.key} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className="px-3 py-2 text-zinc-700">{m.label}</td>
                  {(["ver", "crear", "editar", "eliminar"] as const).map((campo) => {
                    const checked = disabled ? true : p[campo];
                    return (
                      <td key={campo} className="px-3 py-2 text-center">
                        <label
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-150 ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-zinc-300 bg-white hover:bg-zinc-50"
                          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => onChange(m.key, campo, e.target.checked)}
                            className="sr-only"
                          />
                          {checked && <IconCheck className="h-3.5 w-3.5 text-primary" />}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; modo: "crear" }
  | { open: true; modo: "editar"; rol: RolDTO };

// ── Main component ────────────────────────────────────────────────────────────

export default function RolesView({
  roles,
  clienteId,
}: {
  roles: RolDTO[];
  clienteId: string;
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle("Roles");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Form state
  const [formNombre, setFormNombre] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formPermisos, setFormPermisos] = useState<PermisoForm[]>(() => buildPermisosForm([]));
  const [formError, setFormError] = useState<string | null>(null);

  function abrirCrear() {
    setFormNombre("");
    setFormDescripcion("");
    setFormPermisos(buildPermisosForm([]));
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "crear" });
  }

  function abrirEditar(rol: RolDTO) {
    setFormNombre(rol.nombre);
    setFormDescripcion(rol.descripcion ?? "");
    setFormPermisos(buildPermisosForm(rol.permisos));
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "editar", rol });
  }

  function cerrarModal() {
    setModal({ open: false });
    setFormError(null);
  }

  function handlePermisoChange(
    modulo: string,
    campo: "ver" | "crear" | "editar" | "eliminar",
    valor: boolean
  ) {
    setFormPermisos((prev) =>
      prev.map((p: any)=> {
        if (p.modulo !== modulo) return p;
        const updated = { ...p, [campo]: valor };
        // Checking crear/editar/eliminar auto-checks ver
        if (campo !== "ver" && valor) updated.ver = true;
        // Unchecking ver clears all
        if (campo === "ver" && !valor) {
          updated.crear = false;
          updated.editar = false;
          updated.eliminar = false;
        }
        return updated;
      })
    );
  }

  async function handleGuardar() {
    if (!formNombre.trim()) {
      setFormError("El nombre del rol es requerido.");
      return;
    }
    setFormError(null);
    setCargando(true);

    if (!modal.open) { setCargando(false); return; }

    const datos = {
      nombre: formNombre,
      descripcion: formDescripcion || null,
      permisos: formPermisos,
    };

    let result: { ok: boolean; error?: string };
    if (modal.modo === "crear") {
      result = await crearRolAction(clienteId, datos);
    } else {
      result = await actualizarRolAction(modal.rol.id, datos);
    }

    setCargando(false);
    if (!result.ok) {
      setFormError(result.error ?? "Error al guardar.");
      toast.error(result.error ?? "No se pudo guardar el rol.");
      return;
    }
    toast.success(modal.modo === "crear" ? "Rol creado correctamente" : "Rol actualizado correctamente");
    cerrarModal();
    router.refresh();
  }

  async function handleEliminar(id: string) {
    setCargando(true);
    setBannerError(null);
    const result = await eliminarRolAction(id);
    setCargando(false);
    setConfirmandoId(null);
    if (!result.ok) {
      setBannerError(result.error ?? "Error al eliminar.");
      toast.error(result.error ?? "No se pudo eliminar el rol.");
      return;
    }
    toast.success("Rol eliminado correctamente");
    router.refresh();
  }

  const INPUT =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-zinc-400";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="mt-0.5 text-sm text-zinc-500">Define roles y sus permisos de acceso al sistema</p>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center gap-1.5 rounded-md bg-[var(--color-primario)] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
        >
          <IconPlus className="h-4 w-4" />
          Crear rol
        </button>
      </div>

      {bannerError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{bannerError}</span>
          <button type="button" onClick={() => setBannerError(null)} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        {roles.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              icon="IconShield"
              title="Sin roles configurados"
              description="Crea el primer rol para definir qué puede hacer cada usuario en el sistema."
              actionLabel="Crear rol"
              onAction={abrirCrear}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Usuarios</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {roles.map((r: any) => (
                <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-zinc-800">{r.nombre}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.descripcion ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                      {r.usuariosCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.esAdmin
                          ? "bg-amber-100 text-amber-700"
                          : r.esSupervisor
                          ? "bg-purple-100 text-purple-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {r.esAdmin ? "Administrador" : r.esSupervisor ? "Supervisor" : "Personalizado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmandoId === r.id ? (
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <span className="text-zinc-500">¿Eliminar?</span>
                        <button type="button" disabled={cargando} onClick={() => handleEliminar(r.id)} className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">Sí</button>
                        <button type="button" onClick={() => setConfirmandoId(null)} className="text-zinc-400 hover:text-zinc-600">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => abrirEditar(r)} title="Editar permisos" className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150">
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                        {!r.esAdmin && !r.esSupervisor && (
                          <button type="button" onClick={() => setConfirmandoId(r.id)} title="Eliminar" className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-150">
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        )}
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
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                {modal.modo === "crear" ? "Crear rol" : "Editar rol"}
              </h2>
              {modal.modo === "editar" && modal.rol.esAdmin && (
                <p className="mt-0.5 text-xs text-amber-600">
                  Este es un rol de Administrador. Los permisos no se pueden modificar.
                </p>
              )}
              {modal.modo === "editar" && modal.rol.esSupervisor && (
                <p className="mt-0.5 text-xs text-purple-600">
                  Rol de Supervisor: ve licitaciones de todos los compradores.
                </p>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    disabled={modal.modo === "editar" && modal.rol.esAdmin}
                    className={INPUT}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Descripción</label>
                  <input
                    type="text"
                    value={formDescripcion}
                    onChange={(e) => setFormDescripcion(e.target.value)}
                    disabled={modal.modo === "editar" && modal.rol.esAdmin}
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-zinc-700">Permisos por módulo</p>
                <MatrizPermisos
                  permisos={formPermisos}
                  disabled={modal.modo === "editar" && modal.rol.esAdmin}
                  onChange={handlePermisoChange}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-zinc-100 px-6 py-4">
              {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cerrarModal} disabled={cargando} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                  Cancelar
                </button>
                {!(modal.modo === "editar" && modal.rol.esAdmin) && (
                  <button type="button" onClick={handleGuardar} disabled={cargando} className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50">
                    {cargando ? "Guardando…" : "Guardar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
