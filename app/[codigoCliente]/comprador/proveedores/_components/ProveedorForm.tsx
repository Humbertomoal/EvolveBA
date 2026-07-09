"use client";

import {
  IconChevronDown,
  IconFile,
  IconPackage,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Producto } from "@/src/data/productos";
import type { Proveedor } from "@/src/data/proveedores";
import {
  actualizarProveedorAction,
  crearProveedorAction,
} from "@/src/lib/proveedoresActions";
import type { AccesoProveedor } from "@/src/lib/proveedores";
import { isNextRedirectError } from "@/src/lib/isNextRedirectError";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import AccesoPortalSection from "./AccesoPortalSection";

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";
const INPUT_ERR =
  "w-full rounded-md border border-red-500 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-primary/30";

function iCls(hasErr: boolean) {
  return hasErr ? INPUT_ERR : INPUT;
}

const BTN_PRIMARIO =
  "rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150";
const BTN_SECUNDARIO =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors";

// ── Validation helpers ────────────────────────────────────────────────────────

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_RFC_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
const RE_RFC_MORAL = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

function soloDigitos(val: string) {
  return val.replace(/\D/g, "");
}

function formatTel(raw: string): string {
  const d = soloDigitos(raw).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function errCelular(val: string, requerido: boolean): string | null {
  const digitos = soloDigitos(val);
  if (!digitos) return requerido ? "Campo requerido" : null;
  if (digitos.length !== 10) return "El teléfono debe tener 10 dígitos";
  return null;
}

function errCorreo(val: string, requerido: boolean): string | null {
  if (!val.trim()) return requerido ? "Campo requerido" : null;
  if (!RE_EMAIL.test(val)) return "Ingresa un correo electrónico válido";
  return null;
}

function errRfc(val: string, tipo: string): string | null {
  if (!val.trim()) return "Campo requerido";
  const re = tipo === "Fisica" ? RE_RFC_FISICA : RE_RFC_MORAL;
  const label = tipo === "Fisica" ? "Física" : "Moral";
  if (!re.test(val)) return `El RFC no tiene el formato correcto para Persona ${label}`;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProveedorForm({
  basePath,
  proveedorExistente,
  productos = [],
  materialesIniciales = [],
  familiasCatalogo = [],
  familiasIniciales = [],
  esAdmin = false,
  acceso = null,
}: {
  basePath: string;
  proveedorExistente?: Proveedor;
  productos?: Producto[];
  materialesIniciales?: string[];
  familiasCatalogo?: { codigo: string; nombre: string }[];
  familiasIniciales?: string[];
  esAdmin?: boolean;
  acceso?: AccesoProveedor | null;
}) {
  usePageTitle(proveedorExistente ? "Editar proveedor" : "Agregar proveedor");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);

  // ── Field state ───────────────────────────────────────────────────────────────
  const [razonSocial, setRazonSocial] = useState(proveedorExistente?.razonSocial ?? "");
  const [estado, setEstado] = useState(proveedorExistente?.estado ?? "Activo");
  const [vendedorNombre, setVendedorNombre] = useState(proveedorExistente?.vendedorNombre ?? "");
  const [vendedorCelular, setVendedorCelular] = useState(
    formatTel(proveedorExistente?.vendedorCelular ?? "")
  );
  const [vendedorCorreo, setVendedorCorreo] = useState(
    proveedorExistente?.vendedorCorreo ?? ""
  );
  const [contactoAdminNombre, setContactoAdminNombre] = useState(
    proveedorExistente?.contactoAdminNombre ?? ""
  );
  const [contactoAdminTelefono, setContactoAdminTelefono] = useState(
    formatTel(proveedorExistente?.contactoAdminTelefono ?? "")
  );
  const [contactoAdminCorreo, setContactoAdminCorreo] = useState(
    proveedorExistente?.contactoAdminCorreo ?? ""
  );
  const [tipoPersona, setTipoPersona] = useState(
    proveedorExistente?.tipoPersona ?? "Fisica"
  );
  const [rfc, setRfc] = useState(proveedorExistente?.rfc ?? "");
  const [domicilio, setDomicilio] = useState(proveedorExistente?.domicilio ?? "");
  const [domicilioComercialEsIgual, setDomicilioComercialEsIgual] = useState(
    !proveedorExistente?.domicilioComercial ||
      proveedorExistente.domicilioComercial === proveedorExistente.domicilio
  );
  const [domicilioComercial, setDomicilioComercial] = useState(
    proveedorExistente?.domicilioComercial ?? ""
  );

  // ── Validation UI ─────────────────────────────────────────────────────────────
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // ── Materiales state ──────────────────────────────────────────────────────────
  const [materialesSeleccionados, setMaterialesSeleccionados] =
    useState<string[]>(materialesIniciales);
  const [modalMaterialesAbierto, setModalMaterialesAbierto] = useState(false);
  const [busquedaMaterial, setBusquedaMaterial] = useState("");
  const [filtroFamilias, setFiltroFamilias] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [selTempMateriales, setSelTempMateriales] = useState<string[]>([]);
  const [familiasAsignadas, setFamiliasAsignadas] = useState<string[]>(familiasIniciales);
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

  // ── Derived errors ────────────────────────────────────────────────────────────
  const errores = {
    razonSocial: !razonSocial.trim() ? "Campo requerido" : null,
    vendedorCelular: errCelular(vendedorCelular, false),
    vendedorCorreo: errCorreo(vendedorCorreo, false),
    contactoAdminNombre: !contactoAdminNombre.trim() ? "Campo requerido" : null,
    contactoAdminTelefono: errCelular(contactoAdminTelefono, false),
    contactoAdminCorreo: errCorreo(contactoAdminCorreo, true),
    rfc: errRfc(rfc, tipoPersona),
    domicilio: !domicilio.trim() ? "Campo requerido" : null,
    domicilioComercial:
      !domicilioComercialEsIgual && !domicilioComercial.trim()
        ? "Campo requerido"
        : null,
  };

  const hayErrores = Object.values(errores).some(Boolean);

  function tocar(campo: string) {
    setTocados((prev) => new Set([...prev, campo]));
  }

  function verError(campo: keyof typeof errores): string | null {
    if (!intentoGuardar && !tocados.has(campo)) return null;
    return errores[campo];
  }

  // ── Action ────────────────────────────────────────────────────────────────────
  const accion = proveedorExistente
    ? actualizarProveedorAction.bind(null, proveedorExistente.id, basePath)
    : crearProveedorAction.bind(null, basePath);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIntentoGuardar(true);
    if (hayErrores) return;
    setGuardando(true);
    const fd = new FormData(e.currentTarget);
    try {
      await accion(fd);
    } catch (error) {
      if (isNextRedirectError(error)) {
        toast.success("Proveedor guardado correctamente");
        throw error;
      }
      toast.error("No se pudo guardar el proveedor. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  // ── File helpers ──────────────────────────────────────────────────────────────
  // `nuevos` must already be a materialized array (not the live FileList) — by
  // the time React invokes this functional updater, the input's value reset
  // (done right after picking files, to allow re-selecting the same file) has
  // already cleared the live FileList.
  function agregarArchivos(nuevos: File[]) {
    if (nuevos.length === 0) return;
    setArchivos((actuales) => [...actuales, ...nuevos]);
  }

  function quitarArchivo(indice: number) {
    setArchivos((actuales) => actuales.filter((_, i) => i !== indice));
  }

  // ── Material modal helpers ────────────────────────────────────────────────────
  const unidades = [...new Set(productos.map((p: any)=> p.unidadMedida))].sort();

  function abrirModalMateriales() {
    setSelTempMateriales([...materialesSeleccionados]);
    setBusquedaMaterial("");
    setFiltroFamilias([]);
    setFiltroTipo("");
    setFiltroUnidad("");
    setFamiliaDropdownAbierto(false);
    setModalMaterialesAbierto(true);
  }

  const productosFiltrados = productos.filter((p: any) => {
    const q = busquedaMaterial.toLowerCase();
    const matchQ =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q);
    const matchFamilia = filtroFamilias.length === 0 || filtroFamilias.includes(p.familia);
    const matchTipo = !filtroTipo || p.tipoItem === filtroTipo;
    const matchUnidad = !filtroUnidad || p.unidadMedida === filtroUnidad;
    return matchQ && matchFamilia && matchTipo && matchUnidad;
  });

  // Families with at least one currently-selected material — drives the
  // compact chips row below the family filter dropdown.
  const familiasConSeleccion = (() => {
    const conteos = new Map<string, number>();
    for (const id of selTempMateriales) {
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

  function toggleMaterialTemp(id: string) {
    setSelTempMateriales((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
    setSelTempMateriales((prev) => [...new Set([...prev, ...idsFiltradas])]);
    setFamiliaDropdownAbierto(false);
  }

  function verTodosMateriales() {
    setFiltroFamilias([]);
  }

  function quitarFamiliaDeSeleccion(familia: string) {
    const ids = productos.filter((p: any) => p.familia === familia).map((p: any) => p.id);
    setSelTempMateriales((prev) => prev.filter((id) => !ids.includes(id)));
    setFiltroFamilias((prev) => prev.filter((f) => f !== familia));
    setFamiliaDropdownTemp((prev) => prev.filter((f) => f !== familia));
  }

  function seleccionarTodos() {
    setSelTempMateriales(productosFiltrados.map((p: any)=> p.id));
  }

  function deseleccionarTodos() {
    const filtradosIds = productosFiltrados.map((p: any)=> p.id);
    setSelTempMateriales((prev) => prev.filter((id) => !filtradosIds.includes(id)));
  }

  function confirmarMateriales() {
    setMaterialesSeleccionados([...selTempMateriales]);
    setFamiliasAsignadas(familiasConSeleccion.map((f) => f.familia));
    setModalMaterialesAbierto(false);
  }

  function quitarMaterial(id: string) {
    setMaterialesSeleccionados((prev) => prev.filter((x) => x !== id));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Hidden inputs for selected materials */}
        {materialesSeleccionados.map((id) => (
          <input key={id} type="hidden" name="materialId" value={id} />
        ))}
        {familiasAsignadas.map((f) => (
          <input key={f} type="hidden" name="familia" value={f} />
        ))}

        {/* ── Datos del proveedor y vendedor ───────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Datos del proveedor y vendedor
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Proveedor / Razón Social"
              required
              error={verError("razonSocial")}
            >
              <input
                name="razonSocial"
                type="text"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                onBlur={() => tocar("razonSocial")}
                className={iCls(!!verError("razonSocial"))}
              />
            </Campo>
            <Campo label="Estado" required>
              <select
                name="estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as "Activo" | "Inactivo")}
                className={INPUT}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </Campo>
            <Campo label="Nombre del Vendedor">
              <input
                name="vendedorNombre"
                type="text"
                value={vendedorNombre}
                onChange={(e) => setVendedorNombre(e.target.value)}
                className={INPUT}
              />
            </Campo>
            <Campo
              label="Celular del Vendedor"
              error={verError("vendedorCelular")}
            >
              <input
                name="vendedorCelular"
                type="tel"
                value={vendedorCelular}
                onChange={(e) =>
                  setVendedorCelular(formatTel(e.target.value))
                }
                onBlur={() => tocar("vendedorCelular")}
                placeholder="442 123 4567"
                className={iCls(!!verError("vendedorCelular"))}
              />
            </Campo>
            <Campo
              label="Correo del Vendedor"
              error={verError("vendedorCorreo")}
            >
              <input
                name="vendedorCorreo"
                type="email"
                value={vendedorCorreo}
                onChange={(e) => setVendedorCorreo(e.target.value)}
                onBlur={() => tocar("vendedorCorreo")}
                className={iCls(!!verError("vendedorCorreo"))}
              />
            </Campo>
          </div>
        </fieldset>

        {/* ── Contacto administrativo ──────────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Contacto administrativo
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Nombre Contacto Admin"
              required
              error={verError("contactoAdminNombre")}
            >
              <input
                name="contactoAdminNombre"
                type="text"
                value={contactoAdminNombre}
                onChange={(e) => setContactoAdminNombre(e.target.value)}
                onBlur={() => tocar("contactoAdminNombre")}
                className={iCls(!!verError("contactoAdminNombre"))}
              />
            </Campo>
            <Campo
              label="Teléfono Contacto Admin"
              error={verError("contactoAdminTelefono")}
            >
              <input
                name="contactoAdminTelefono"
                type="tel"
                value={contactoAdminTelefono}
                onChange={(e) =>
                  setContactoAdminTelefono(formatTel(e.target.value))
                }
                onBlur={() => tocar("contactoAdminTelefono")}
                placeholder="442 123 4567"
                className={iCls(!!verError("contactoAdminTelefono"))}
              />
            </Campo>
            <Campo
              label="Correo Contacto Admin"
              required
              error={verError("contactoAdminCorreo")}
            >
              <input
                name="contactoAdminCorreo"
                type="email"
                value={contactoAdminCorreo}
                onChange={(e) => setContactoAdminCorreo(e.target.value)}
                onBlur={() => tocar("contactoAdminCorreo")}
                className={iCls(!!verError("contactoAdminCorreo"))}
              />
            </Campo>
          </div>
        </fieldset>

        {/* ── Acceso al Portal ─────────────────────────────────────────────── */}
        {esAdmin &&
          (proveedorExistente ? (
            <AccesoPortalSection
              proveedorId={proveedorExistente.id}
              acceso={acceso}
              correoSugerido={proveedorExistente.vendedorCorreo}
              basePath={basePath}
            />
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-zinc-900">
                Acceso al Portal
              </legend>
              <p className="text-xs text-zinc-500">
                Podrás generar el acceso al portal para este proveedor después de
                guardarlo.
              </p>
            </fieldset>
          ))}

        {/* ── Datos fiscales ───────────────────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Datos fiscales
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="RFC" required error={verError("rfc")}>
              <input
                name="rfc"
                type="text"
                value={rfc}
                onChange={(e) =>
                  setRfc(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-ZÑ&0-9]/g, "")
                      .slice(0, 13)
                  )
                }
                onBlur={() => tocar("rfc")}
                placeholder={
                  tipoPersona === "Fisica" ? "AAAA######AAA" : "AAA######AAA"
                }
                className={iCls(!!verError("rfc"))}
              />
            </Campo>
            <Campo label="Tipo de Persona" required>
              <select
                name="tipoPersona"
                value={tipoPersona}
                onChange={(e) => setTipoPersona(e.target.value as "Fisica" | "Moral")}
                className={INPUT}
              >
                <option value="Fisica">Física</option>
                <option value="Moral">Moral</option>
              </select>
            </Campo>
            <Campo
              label="Domicilio Fiscal"
              required
              className="sm:col-span-2"
              error={verError("domicilio")}
            >
              <textarea
                name="domicilio"
                rows={3}
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
                onBlur={() => tocar("domicilio")}
                className={iCls(!!verError("domicilio"))}
              />
            </Campo>
            <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={domicilioComercialEsIgual}
                onChange={(e) => setDomicilioComercialEsIgual(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              El domicilio comercial es el mismo que el fiscal
            </label>
            {domicilioComercialEsIgual ? (
              <input type="hidden" name="domicilioComercial" value={domicilio} />
            ) : (
              <Campo
                label="Domicilio Comercial"
                required
                className="sm:col-span-2"
                error={verError("domicilioComercial")}
              >
                <textarea
                  name="domicilioComercial"
                  rows={3}
                  value={domicilioComercial}
                  onChange={(e) => setDomicilioComercial(e.target.value)}
                  onBlur={() => tocar("domicilioComercial")}
                  className={iCls(!!verError("domicilioComercial"))}
                />
              </Campo>
            )}
          </div>
        </fieldset>

        {/* ── Archivos adjuntos ────────────────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Archivos adjuntos
          </legend>
          <p className="text-xs text-zinc-500">
            Constancia de situación fiscal, comprobante de domicilio, u otros
            documentos.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(event) => {
              const nuevos = Array.from(event.target.files ?? []);
              event.target.value = "";
              agregarArchivos(nuevos);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <IconUpload className="h-4 w-4" />
            Seleccionar archivos
          </button>

          {archivos.length > 0 && (
            <ul className="space-y-2">
              {archivos.map((archivo, indice) => (
                <li
                  key={`${archivo.name}-${indice}`}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-zinc-700">
                    <IconFile className="h-4 w-4 text-zinc-400" />
                    {archivo.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarArchivo(indice)}
                    aria-label={`Quitar ${archivo.name}`}
                    className="text-zinc-400 hover:text-zinc-700"
                  >
                    <IconX className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {/* ── Materiales que provee ─────────────────────────────────────────── */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Materiales que provee
          </legend>
          <p className="text-xs text-zinc-500">
            Define el catálogo de productos o servicios que este proveedor puede
            suministrar.
          </p>

          <button
            type="button"
            onClick={abrirModalMateriales}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <IconPackage className="h-4 w-4" />
            Seleccionar materiales
            {materialesSeleccionados.length > 0 && (
              <span className="rounded-full bg-[var(--color-primario)] px-1.5 py-0.5 text-xs font-medium leading-none text-white">
                {materialesSeleccionados.length}
              </span>
            )}
          </button>

          {materialesSeleccionados.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {materialesSeleccionados.map((id) => {
                const prod = productos.find((p: any)  => p.id === id);
                if (!prod) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {prod.nombre}
                    <button
                      type="button"
                      onClick={() => quitarMaterial(id)}
                      aria-label={`Quitar ${prod.nombre}`}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </fieldset>

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-t border-zinc-200 pt-6">
          <button
            type="submit"
            disabled={hayErrores || guardando}
            className={`${BTN_PRIMARIO} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <Link
            href={`${basePath}/comprador/proveedores`}
            className={BTN_SECUNDARIO}
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* ── Modal: Seleccionar materiales ─────────────────────────────────────── */}
      {modalMaterialesAbierto && (
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
                onClick={() => setModalMaterialesAbierto(false)}
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
                value={busquedaMaterial}
                onChange={(e) => setBusquedaMaterial(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tipo: Todos</option>
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                </select>
                <select
                  value={filtroUnidad}
                  onChange={(e) => setFiltroUnidad(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Unidad: Todas</option>
                  {unidades.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
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
            <div className="flex-1 overflow-y-auto px-5 py-1" style={{ minHeight: 0 }}>
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
                          checked={selTempMateriales.includes(p.id)}
                          onChange={() => toggleMaterialTemp(p.id)}
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
                {selTempMateriales.length === 0
                  ? "Ningún material seleccionado"
                  : `${selTempMateriales.length} material${selTempMateriales.length !== 1 ? "es" : ""} seleccionado${selTempMateriales.length !== 1 ? "s" : ""}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalMaterialesAbierto(false)}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarMateriales}
                  className={BTN_PRIMARIO}
                >
                  Confirmar selección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campo wrapper ─────────────────────────────────────────────────────────────

function Campo({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-zinc-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
