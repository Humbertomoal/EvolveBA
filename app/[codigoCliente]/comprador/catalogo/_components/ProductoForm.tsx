"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Producto } from "@/src/data/productos";
import {
  actualizarProductoAction,
  crearProductoAction,
  generarCodigoProductoAction,
  verificarCodigoDisponibleAction,
} from "@/src/lib/productosActions";
import { isNextRedirectError } from "@/src/lib/isNextRedirectError";
import { MONEDAS } from "@/src/lib/monedas";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import FileUpload from "@/src/components/FileUpload";

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const TIPOS_ESPECIFICACIONES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function parsearJsonArray(json?: string): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30";
const INPUT_ERR =
  "w-full rounded-md border border-red-500 px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-primary/30";

function iCls(hasErr: boolean) {
  return hasErr ? INPUT_ERR : INPUT;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductoForm({
  basePath,
  productoExistente,
  catalogos,
}: {
  basePath: string;
  productoExistente?: Producto;
  catalogos?: {
    familias: { codigo: string; nombre: string }[];
    unidadesMedida: { codigo: string; nombre: string }[];
    monedas: { codigo: string; nombre: string; simbolo?: string | null }[];
  };
}) {
  usePageTitle(productoExistente ? "Editar producto" : "Agregar producto");

  // ── Image state ───────────────────────────────────────────────────────────────
  const [imagenUrl, setImagenUrl] = useState<string>(
    productoExistente?.imagenUrl ?? ""
  );

  // ── Field state ───────────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState(productoExistente?.nombre ?? "");
  const [tipoItem, setTipoItem] = useState(
    productoExistente?.tipoItem ?? "Producto"
  );
  const [familia, setFamilia] = useState(productoExistente?.familia ?? "");
  const [unidadMedida, setUnidadMedida] = useState(
    productoExistente?.unidadMedida ?? ""
  );
  const [codigo, setCodigo] = useState(productoExistente?.codigo ?? "");
  const [codigoManual, setCodigoManual] = useState(
    productoExistente?.codigoManual ?? false
  );
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const [descripcion, setDescripcion] = useState(
    productoExistente?.descripcion ?? ""
  );
  const [monedaPredeterminada, setMonedaPredeterminada] = useState(
    productoExistente?.monedaPredeterminada ?? "MXN"
  );
  const [especificacionesTecnicas, setEspecificacionesTecnicas] = useState(
    productoExistente?.especificacionesTecnicas ?? ""
  );
  const [archivosEspecificaciones, setArchivosEspecificaciones] = useState<string[]>(
    () => parsearJsonArray(productoExistente?.archivosEspecificaciones)
  );

  // ── Validation state ──────────────────────────────────────────────────────────
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Código uniqueness check
  const [codigoDisponible, setCodigoDisponible] = useState<boolean | null>(null);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!codigo.trim()) {
      setCodigoDisponible(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setVerificandoCodigo(true);
    debounceRef.current = setTimeout(async () => {
      const disponible = await verificarCodigoDisponibleAction(
        codigo,
        productoExistente?.id
      );
      setCodigoDisponible(disponible);
      setVerificandoCodigo(false);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [codigo, productoExistente?.id]);

  // ── Autogeneración de código a partir de familia + nombre ───────────────────────
  const primerRenderAutoRef = useRef(true);
  const autoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // No regenerar en el montaje inicial: solo ante cambios posteriores de
    // familia/nombre hechos por el usuario (regla 6).
    if (primerRenderAutoRef.current) {
      primerRenderAutoRef.current = false;
      return;
    }
    if (codigoManual) return;
    if (!nombre.trim()) return;

    if (autoDebounceRef.current) clearTimeout(autoDebounceRef.current);
    autoDebounceRef.current = setTimeout(async () => {
      setGenerandoCodigo(true);
      const nuevoCodigo = await generarCodigoProductoAction(
        familia,
        nombre,
        productoExistente?.id
      );
      setGenerandoCodigo(false);
      if (nuevoCodigo) setCodigo(nuevoCodigo);
    }, 500);
    return () => {
      if (autoDebounceRef.current) clearTimeout(autoDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familia, nombre]);

  async function regenerarCodigo() {
    if (!nombre.trim()) return;
    setGenerandoCodigo(true);
    const nuevoCodigo = await generarCodigoProductoAction(
      familia,
      nombre,
      productoExistente?.id
    );
    setGenerandoCodigo(false);
    if (nuevoCodigo) {
      setCodigo(nuevoCodigo);
      setCodigoManual(false);
    }
  }

  // ── Derived errors ────────────────────────────────────────────────────────────
  const RE_CODIGO = /^[A-Za-z0-9-]+$/;

  const errores = {
    nombre: !nombre.trim() ? "Campo requerido" : null,
    unidadMedida: !unidadMedida.trim() ? "Campo requerido" : null,
    codigo: !codigo.trim()
      ? "Campo requerido"
      : !RE_CODIGO.test(codigo)
        ? "Solo se permiten letras, números y guiones"
        : codigoDisponible === false
          ? "Este código ya está en uso por otro producto"
          : null,
  };

  const hayErrores =
    Object.values(errores).some(Boolean) ||
    verificandoCodigo;

  function tocar(campo: string) {
    setTocados((prev) => new Set([...prev, campo]));
  }

  function verError(campo: keyof typeof errores): string | null {
    if (!intentoGuardar && !tocados.has(campo)) return null;
    return errores[campo];
  }

  // ── Codigo input handler ──────────────────────────────────────────────────────
  function handleCodigoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\s/g, "-");
    setCodigo(raw);
    setCodigoManual(true);
  }

  // ── Action ────────────────────────────────────────────────────────────────────
  const accion = productoExistente
    ? actualizarProductoAction.bind(null, productoExistente.id, basePath)
    : crearProductoAction.bind(null, basePath);

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
        toast.success("Producto guardado correctamente");
        throw error;
      }
      if (error instanceof Error && error.message === "CODIGO_DUPLICADO") {
        setCodigoDisponible(false);
        toast.error("Este código ya está en uso por otro producto.");
      } else {
        toast.error("No se pudo guardar el producto. Intenta de nuevo.");
      }
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-10">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Información del item
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nombre del Item" required error={verError("nombre")}>
              <input
                name="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => tocar("nombre")}
                className={iCls(!!verError("nombre"))}
              />
            </Campo>

            <Campo label="Tipo de Item" required>
              <select
                name="tipoItem"
                value={tipoItem}
                onChange={(e) => setTipoItem(e.target.value as "Producto" | "Servicio")}
                className={INPUT}
              >
                <option value="Producto">Producto</option>
                <option value="Servicio">Servicio</option>
              </select>
            </Campo>

            <Campo label="Familia de Item">
              {catalogos?.familias && catalogos.familias.length > 0 ? (
                <select
                  name="familia"
                  value={familia}
                  onChange={(e) => setFamilia(e.target.value)}
                  className={INPUT}
                >
                  <option value="">Sin familia</option>
                  {catalogos.familias.map((f) => (
                    <option key={f.codigo} value={f.nombre}>{f.nombre}</option>
                  ))}
                </select>
              ) : (
                <input
                  name="familia"
                  type="text"
                  value={familia}
                  onChange={(e) => setFamilia(e.target.value)}
                  placeholder="Ej. Materias Primas, Empaques..."
                  className={INPUT}
                />
              )}
            </Campo>

            <Campo
              label="Unidad de Medida"
              required
              error={verError("unidadMedida")}
            >
              {catalogos?.unidadesMedida && catalogos.unidadesMedida.length > 0 ? (
                <select
                  name="unidadMedida"
                  value={unidadMedida}
                  onChange={(e) => { setUnidadMedida(e.target.value); tocar("unidadMedida"); }}
                  className={iCls(!!verError("unidadMedida"))}
                >
                  <option value="">Seleccionar...</option>
                  {catalogos.unidadesMedida.map((u) => (
                    <option key={u.codigo} value={u.nombre}>{u.nombre}</option>
                  ))}
                </select>
              ) : (
                <input
                  name="unidadMedida"
                  type="text"
                  value={unidadMedida}
                  onChange={(e) => setUnidadMedida(e.target.value)}
                  onBlur={() => tocar("unidadMedida")}
                  placeholder="Ej. Toneladas, Piezas, Litros..."
                  className={iCls(!!verError("unidadMedida"))}
                />
              )}
            </Campo>

            <Campo label="Código de Item" required error={verError("codigo")}>
              <input type="hidden" name="codigoManual" value={String(codigoManual)} />
              <div className="flex items-start gap-2">
                <div className="relative flex-1">
                  <input
                    name="codigo"
                    type="text"
                    value={codigo}
                    onChange={handleCodigoChange}
                    onBlur={() => tocar("codigo")}
                    placeholder="Ej. MAT-001"
                    className={iCls(!!verError("codigo"))}
                  />
                  {(verificandoCodigo || generandoCodigo) && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      {generandoCodigo ? "Generando…" : "Verificando…"}
                    </span>
                  )}
                  {!verificandoCodigo &&
                    !generandoCodigo &&
                    codigoDisponible === true &&
                    codigo.trim() && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-green-600">
                        Disponible
                      </span>
                    )}
                </div>
                {codigoManual && (
                  <button
                    type="button"
                    onClick={regenerarCodigo}
                    disabled={!nombre.trim() || generandoCodigo}
                    className="whitespace-nowrap rounded-md border border-zinc-300 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Regenerar código
                  </button>
                )}
              </div>
            </Campo>

            <Campo label="Moneda predeterminada" required>
              <select
                name="monedaPredeterminada"
                value={monedaPredeterminada}
                onChange={(e) => setMonedaPredeterminada(e.target.value)}
                className={INPUT}
              >
                {(catalogos?.monedas && catalogos.monedas.length > 0
                  ? catalogos.monedas
                  : MONEDAS
                ).map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.codigo}</option>
                ))}
              </select>
            </Campo>

            <Campo
              label="Descripción del Item"
              className="sm:col-span-2"
            >
              <textarea
                name="descripcion"
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={INPUT}
              />
            </Campo>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Imagen del producto
          </legend>

          <input type="hidden" name="imagenUrl" value={imagenUrl} />
          <FileUpload
            carpeta="productos/imagenes"
            tiposPermitidos={TIPOS_IMAGEN}
            maxSizeMB={5}
            multiple={false}
            archivosExistentes={imagenUrl ? [imagenUrl] : []}
            onUploadComplete={(urls) => setImagenUrl(urls[0] ?? "")}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            Especificaciones Técnicas
          </legend>

          <Campo label="Descripción de especificaciones técnicas">
            <textarea
              name="especificacionesTecnicas"
              rows={4}
              value={especificacionesTecnicas}
              onChange={(e) => setEspecificacionesTecnicas(e.target.value)}
              className={INPUT}
            />
          </Campo>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-700">
              Subir especificaciones técnicas (planos, fichas, etc.)
            </span>

            <input
              type="hidden"
              name="archivosEspecificaciones"
              value={JSON.stringify(archivosEspecificaciones)}
            />
            <FileUpload
              carpeta="productos/especificaciones"
              tiposPermitidos={TIPOS_ESPECIFICACIONES}
              maxSizeMB={10}
              multiple
              archivosExistentes={archivosEspecificaciones}
              onUploadComplete={setArchivosEspecificaciones}
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-3 border-t border-zinc-200 pt-6">
          <button
            type="submit"
            disabled={hayErrores || guardando}
            className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <Link
            href={`${basePath}/comprador/catalogo`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
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
