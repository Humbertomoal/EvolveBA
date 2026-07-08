"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import toast from "react-hot-toast";
import type { UsuarioDTO, RolDTO } from "@/src/lib/usuariosTypes";
import {
  crearUsuarioAction,
  actualizarUsuarioAction,
  toggleActivoUsuarioAction,
} from "@/src/lib/usuariosActions";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import EmptyState from "@/src/components/EmptyState";

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, apellido, avatar }: { nombre: string; apellido: string; avatar: string | null }) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt={`${nombre} ${apellido}`} className="h-8 w-8 rounded-full object-cover" />
    );
  }
  const initials = `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primario)] text-xs font-semibold text-white">
      {initials}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MetodoAcceso = "microsoft" | "password";

type ModalState =
  | { open: false }
  | { open: true; modo: "crear" }
  | { open: true; modo: "editar"; usuario: UsuarioDTO };

// ── Main component ────────────────────────────────────────────────────────────

export default function UsuariosView({
  usuarios,
  roles,
  clienteId,
}: {
  usuarios: UsuarioDTO[];
  roles: RolDTO[];
  clienteId: string;
  basePath: string;
}) {
  const router = useRouter();
  usePageTitle("Usuarios");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Form state
  const [formNombre, setFormNombre] = useState("");
  const [formApellido, setFormApellido] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formMetodo, setFormMetodo] = useState<MetodoAcceso>("password");
  const [formPassword, setFormPassword] = useState("");
  const [formRolId, setFormRolId] = useState(roles[0]?.id ?? "");
  const [formActivo, setFormActivo] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  function abrirCrear() {
    setFormNombre("");
    setFormApellido("");
    setFormEmail("");
    setFormMetodo("password");
    setFormPassword("");
    setFormRolId(roles[0]?.id ?? "");
    setFormActivo(true);
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "crear" });
  }

  function abrirEditar(u: UsuarioDTO) {
    setFormNombre(u.nombre);
    setFormApellido(u.apellido);
    setFormEmail(u.email);
    setFormMetodo(u.usaMicrosoft ? "microsoft" : "password");
    setFormPassword("");
    setFormRolId(u.rolId);
    setFormActivo(u.activo);
    setFormError(null);
    setBannerError(null);
    setModal({ open: true, modo: "editar", usuario: u });
  }

  function cerrarModal() {
    setModal({ open: false });
    setFormError(null);
  }

  async function handleGuardar() {
    if (!formNombre.trim() || !formApellido.trim() || !formEmail.trim()) {
      setFormError("Nombre, apellido y email son requeridos.");
      return;
    }
    if (!formRolId) {
      setFormError("Selecciona un rol.");
      return;
    }
    if (formMetodo === "password" && modal.open && modal.modo === "crear" && !formPassword.trim()) {
      setFormError("La contraseña temporal es requerida.");
      return;
    }
    setFormError(null);
    setCargando(true);

    const datos = {
      nombre: formNombre,
      apellido: formApellido,
      email: formEmail,
      rolId: formRolId,
      activo: formActivo,
      password: formMetodo === "password" ? (formPassword.trim() || null) : null,
      microsoftId: formMetodo === "microsoft" ? formEmail.trim() : null,
    };

    if (!modal.open) { setCargando(false); return; }

    let result: { ok: boolean; error?: string };
    if (modal.modo === "crear") {
      result = await crearUsuarioAction(clienteId, datos);
    } else {
      result = await actualizarUsuarioAction(modal.usuario.id, datos);
    }

    setCargando(false);
    if (!result.ok) {
      setFormError(result.error ?? "Error al guardar.");
      toast.error(result.error ?? "No se pudo guardar el usuario.");
      return;
    }
    toast.success(
      modal.modo === "crear" ? "Usuario creado correctamente" : "Usuario actualizado correctamente"
    );
    cerrarModal();
    router.refresh();
  }

  async function handleToggleActivo(id: string, activo: boolean) {
    await toggleActivoUsuarioAction(id, !activo);
    toast.success(activo ? "Usuario desactivado" : "Usuario activado");
    router.refresh();
  }

  function formatFecha(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const INPUT =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-zinc-400";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="mt-0.5 text-sm text-zinc-500">Administra los usuarios del sistema</p>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center gap-1.5 rounded-md bg-[var(--color-primario)] px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)]"
        >
          <IconPlus className="h-4 w-4" />
          Agregar usuario
        </button>
      </div>

      {bannerError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{bannerError}</span>
          <button type="button" onClick={() => setBannerError(null)} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="rounded-card border border-border bg-white shadow-card overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              icon="IconUsers"
              title="Sin usuarios registrados"
              description="Agrega el primer usuario para que pueda acceder al sistema."
              actionLabel="Agregar usuario"
              onAction={abrirCrear}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Acceso</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acceso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={u.nombre} apellido={u.apellido} avatar={u.avatar} />
                        <span className="font-medium text-zinc-800">{u.nombre} {u.apellido}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        {u.rolNombre}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.usaMicrosoft ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>
                        {u.usaMicrosoft ? "Microsoft" : "Contraseña"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(u.id, u.activo)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${u.activo ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatFecha(u.ultimoAcceso)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEditar(u)}
                        title="Editar"
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors duration-150"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-zinc-900">
              {modal.modo === "crear" ? "Agregar usuario" : "Editar usuario"}
            </h2>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre <span className="text-red-500">*</span></label>
                  <input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className={INPUT} autoFocus />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Apellido <span className="text-red-500">*</span></label>
                  <input type="text" value={formApellido} onChange={(e) => setFormApellido(e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Email <span className="text-red-500">*</span></label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className={INPUT} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Método de acceso</label>
                <div className="flex gap-2">
                  {(["password", "microsoft"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormMetodo(m)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${formMetodo === m ? "border-[var(--color-primario)] bg-[var(--color-primario)]/10 text-[var(--color-primario)]" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      {m === "microsoft" ? "Microsoft SSO" : "Correo y contraseña"}
                    </button>
                  ))}
                </div>
              </div>

              {formMetodo === "password" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Contraseña temporal {modal.modo === "crear" && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={modal.modo === "editar" ? "Dejar vacío para no cambiar" : ""}
                    className={INPUT}
                  />
                  {modal.modo === "crear" && (
                    <p className="mt-1 text-xs text-zinc-400">El usuario deberá cambiarla en su primer acceso.</p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Rol <span className="text-red-500">*</span></label>
                <select value={formRolId} onChange={(e) => setFormRolId(e.target.value)} className={INPUT}>
                  <option value="">Seleccionar rol...</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={formActivo} onChange={(e) => setFormActivo(e.target.checked)} className="rounded border-zinc-300" />
                <span className="text-sm text-zinc-700">Activo</span>
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={cerrarModal} disabled={cargando} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={handleGuardar} disabled={cargando} className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-50">
                {cargando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
