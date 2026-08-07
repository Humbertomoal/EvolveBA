"use client";

import {
  IconCheck,
  IconCopy,
  IconKey,
  IconLock,
  IconLockOpen,
  IconMail,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  cambiarCorreoAccesoProveedorAction,
  crearAccesoProveedorAction,
  restablecerPasswordProveedorAction,
  toggleActivoAccesoProveedorAction,
} from "@/src/lib/proveedorAccesoActions";
import type { AccesoProveedor } from "@/src/lib/proveedores";
import ModalCorreo from "@/src/components/ModalCorreo";
import BotonEnviarCorreo from "@/src/components/BotonEnviarCorreo";

const BTN_PRIMARIO =
  "rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

const AVISO_PASSWORD_NO_RECUPERABLE =
  'La contraseña temporal no se puede recuperar. Si el proveedor la perdió, usa "Restablecer contraseña" primero — así generas una nueva y puedes reenviar el correo con la contraseña real.';

function formatFechaHora(iso: string | null): string {
  if (!iso) return "Nunca ha ingresado";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Prefiere el correo de contacto administrativo; si coincide con el de
 * acceso o no existe, cae al de acceso (el mismo que se usó como usuario). */
function resolverDestinatario(correoContacto: string, correoAcceso: string): string {
  const contacto = correoContacto.trim();
  return contacto && contacto.toLowerCase() !== correoAcceso.toLowerCase()
    ? contacto
    : correoAcceso;
}

export default function AccesoPortalSection({
  proveedorId,
  acceso,
  correoSugerido,
  basePath,
  codigoCliente,
  nombreProveedor,
  nombreContacto,
  correoContacto,
  vendedorCorreo,
}: {
  proveedorId: string;
  acceso: AccesoProveedor | null;
  correoSugerido: string;
  basePath: string;
  codigoCliente: string;
  nombreProveedor: string;
  nombreContacto: string;
  correoContacto: string;
  /** Contacto comercial del proveedor. Solo es un atajo para rellenar el
   *  correo de acceso: los dos campos siguen siendo independientes. */
  vendedorCorreo: string;
}) {
  const router = useRouter();
  const [activarToggle, setActivarToggle] = useState(false);
  const [email, setEmail] = useState(correoSugerido);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<
    { email: string; passwordTemporal: string } | null
  >(null);
  const [mostrarModalCorreo, setMostrarModalCorreo] = useState(false);
  // Cambio del correo de LOGIN (Usuario.email). Independiente de
  // vendedorCorreo: editar el contacto comercial no cambia la credencial.
  const [editandoCorreo, setEditandoCorreo] = useState(false);
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);

  async function handleGenerarAcceso() {
    setError(null);
    setCargando(true);
    const resultado = await crearAccesoProveedorAction(proveedorId, email, basePath);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setCredenciales({ email: resultado.email, passwordTemporal: resultado.passwordTemporal });
    setActivarToggle(false);
    router.refresh();
  }

  async function handleRestablecer() {
    if (
      !window.confirm(
        "¿Restablecer la contraseña? La contraseña actual dejará de funcionar."
      )
    ) {
      return;
    }
    setError(null);
    setCargando(true);
    const resultado = await restablecerPasswordProveedorAction(proveedorId, basePath);
    setCargando(false);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setCredenciales({ email: resultado.email, passwordTemporal: resultado.passwordTemporal });
    router.refresh();
  }

  function abrirCambioCorreo() {
    setNuevoCorreo(acceso?.email ?? "");
    setErrorCorreo(null);
    setEditandoCorreo(true);
  }

  async function handleCambiarCorreo() {
    setErrorCorreo(null);
    setCargando(true);
    const resultado = await cambiarCorreoAccesoProveedorAction(
      proveedorId,
      nuevoCorreo,
      basePath
    );
    setCargando(false);
    if (!resultado.ok) {
      setErrorCorreo(resultado.error);
      return;
    }
    setEditandoCorreo(false);
    toast.success(
      `Correo de acceso actualizado. El proveedor ahora inicia sesión con ${resultado.email}.`,
      { duration: 6000 }
    );
    router.refresh();
  }

  async function handleToggleActivo() {
    if (!acceso) return;
    const nuevoActivo = !acceso.activo;
    const mensaje = nuevoActivo
      ? "¿Activar el acceso al portal de este proveedor?"
      : "¿Desactivar el acceso al portal de este proveedor? No podrá iniciar sesión mientras esté desactivado.";
    if (!window.confirm(mensaje)) return;
    setCargando(true);
    const resultado = await toggleActivoAccesoProveedorAction(
      proveedorId,
      nuevoActivo,
      basePath
    );
    setCargando(false);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(nuevoActivo ? "Acceso activado" : "Acceso desactivado");
    router.refresh();
  }

  async function copiarCredenciales() {
    if (!credenciales) return;
    const texto = `Email: ${credenciales.email}\nContraseña temporal: ${credenciales.passwordTemporal}`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Credenciales copiadas");
    } catch {
      toast.error("No se pudo copiar. Copia manualmente.");
    }
  }

  const correoContactoValido = correoContacto.trim().length > 0;

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-zinc-900">Acceso al Portal</legend>

      {/* ── Caso B: ya tiene acceso ────────────────────────────────────────── */}
      {acceso ? (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-zinc-700">
              <IconKey className="h-4 w-4 text-zinc-400" />
              {acceso.email}
            </span>
            {acceso.activo ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Acceso activo
              </span>
            ) : (
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                Acceso desactivado
              </span>
            )}
            {acceso.primerAcceso && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Pendiente de primer acceso
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Último acceso: {formatFechaHora(acceso.ultimoAcceso)}
          </p>

          {/* ── Cambiar el correo de LOGIN ───────────────────────────────────
              Usuario.email es la credencial, independiente de vendedorCorreo:
              editar el contacto comercial del proveedor NO la cambia. */}
          {editandoCorreo && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <label className="block text-xs font-medium text-zinc-700">
                Nuevo correo de acceso
              </label>
              <input
                type="email"
                value={nuevoCorreo}
                onChange={(e) => setNuevoCorreo(e.target.value)}
                placeholder="correo@empresa.com"
                autoFocus
                className={INPUT}
              />
              <p className="text-xs text-zinc-500">
                Con este correo iniciará sesión el proveedor. Su contraseña no
                cambia. Este dato es independiente del correo de contacto del
                vendedor.
              </p>

              {/* Atajo de captura, NO una sincronización: rellena el input y el
                  comprador decide. Los dos campos siguen siendo independientes.
                  Se oculta si el proveedor no tiene correo de vendedor, o si ya
                  es el que está escrito. */}
              {vendedorCorreo.trim() &&
                vendedorCorreo.trim().toLowerCase() !== nuevoCorreo.trim().toLowerCase() && (
                  <button
                    type="button"
                    onClick={() => setNuevoCorreo(vendedorCorreo.trim())}
                    disabled={cargando}
                    className="text-xs font-medium text-[var(--color-primario)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Usar el correo del vendedor ({vendedorCorreo.trim()})
                  </button>
                )}
              {errorCorreo && <p className="text-xs text-red-600">{errorCorreo}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCambiarCorreo}
                  disabled={cargando || !nuevoCorreo.trim()}
                  className={BTN_PRIMARIO}
                >
                  {cargando ? "Guardando…" : "Guardar correo"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoCorreo(false)}
                  disabled={cargando}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRestablecer}
              disabled={cargando}
              className={`${BTN_SECUNDARIO} flex items-center gap-2`}
            >
              <IconRefresh className="h-4 w-4" />
              Restablecer contraseña
            </button>
            <button
              type="button"
              onClick={abrirCambioCorreo}
              disabled={cargando || editandoCorreo}
              className={`${BTN_SECUNDARIO} flex items-center gap-2`}
            >
              <IconMail className="h-4 w-4" />
              Cambiar correo de acceso
            </button>
            <button
              type="button"
              onClick={handleToggleActivo}
              disabled={cargando}
              className={`${BTN_SECUNDARIO} flex items-center gap-2`}
            >
              {acceso.activo ? (
                <>
                  <IconLock className="h-4 w-4" />
                  Desactivar acceso
                </>
              ) : (
                <>
                  <IconLockOpen className="h-4 w-4" />
                  Activar acceso
                </>
              )}
            </button>
            <BotonEnviarCorreo
              tipo="ALTA_PROVEEDOR"
              etiqueta="Reenviar correo de bienvenida"
              codigoCliente={codigoCliente}
              variables={{
                nombreProveedor,
                nombreContacto,
                usuarioAcceso: acceso.email,
                passwordTemporal:
                  '(usa la opción "Restablecer contraseña" para generar una nueva)',
              }}
              destinatarios={[resolverDestinatario(correoContacto, acceso.email)]}
              deshabilitado={!correoContactoValido}
              tooltipDeshabilitado={
                !correoContactoValido
                  ? "Este proveedor no tiene un correo de contacto registrado."
                  : undefined
              }
              aviso={AVISO_PASSWORD_NO_RECUPERABLE}
            />
          </div>
        </div>
      ) : (
        /* ── Caso A: sin acceso todavía ──────────────────────────────────── */
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={activarToggle}
              onChange={(e) => {
                setActivarToggle(e.target.checked);
                setError(null);
              }}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Crear acceso al portal para este proveedor
          </label>

          {activarToggle && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700">Correo de acceso</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT}
                  placeholder="correo@proveedor.com"
                />
              </label>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="button"
                onClick={handleGenerarAcceso}
                disabled={cargando || !email.trim()}
                className={BTN_PRIMARIO}
              >
                {cargando ? "Generando…" : "Generar acceso"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: credenciales generadas (se muestran una sola vez) ──────── */}
      {credenciales && !mostrarModalCorreo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Acceso creado</h2>
              <button
                type="button"
                onClick={() => setCredenciales(null)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-zinc-700">
                Comparte estas credenciales con el proveedor:
              </p>
              <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <p>
                  <span className="font-medium text-zinc-600">Email:</span>{" "}
                  <span className="font-semibold text-zinc-900">{credenciales.email}</span>
                </p>
                <p>
                  <span className="font-medium text-zinc-600">Contraseña temporal:</span>{" "}
                  <span className="font-mono font-semibold text-zinc-900">
                    {credenciales.passwordTemporal}
                  </span>
                </p>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Esta contraseña no se volverá a mostrar.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setCredenciales(null)}
                className={BTN_SECUNDARIO}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={copiarCredenciales}
                className={`${BTN_SECUNDARIO} flex items-center gap-2`}
              >
                <IconCopy className="h-4 w-4" />
                Copiar credenciales
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalCorreo(true)}
                className={`${BTN_PRIMARIO} flex items-center gap-2`}
              >
                Enviar correo de bienvenida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: vista previa/edición/envío del correo de bienvenida ────── */}
      {credenciales && (
        <ModalCorreo
          abierto={mostrarModalCorreo}
          onCerrar={() => setMostrarModalCorreo(false)}
          tipo="ALTA_PROVEEDOR"
          codigoCliente={codigoCliente}
          variables={{
            nombreProveedor,
            nombreContacto,
            usuarioAcceso: credenciales.email,
            passwordTemporal: credenciales.passwordTemporal,
          }}
          destinatarios={[resolverDestinatario(correoContacto, credenciales.email)]}
          onEnviado={() => {
            setMostrarModalCorreo(false);
            setCredenciales(null);
          }}
        />
      )}
    </fieldset>
  );
}
