"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  IconCloudUpload,
  IconFileText,
  IconFileTypeDoc,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPhoto,
  IconX,
} from "@tabler/icons-react";
import { eliminarArchivo, subirArchivo } from "@/src/lib/supabaseStorage";

// ── Types ─────────────────────────────────────────────────────────────────────

type ArchivoItem = {
  url: string;
  nombre: string;
  tamanoBytes?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function nombreDesdeUrl(url: string): string {
  try {
    const sinQuery = url.split("?")[0];
    const partes = sinQuery.split("/");
    const archivo = decodeURIComponent(partes[partes.length - 1] ?? "");
    return archivo.replace(/^\d+-/, "") || archivo;
  } catch {
    return url;
  }
}

function formatTamano(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function esImagen(nombre: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(nombre);
}

function IconoArchivo({ nombre }: { nombre: string }) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (esImagen(nombre)) return <IconPhoto className="h-5 w-5 text-zinc-400" />;
  if (ext === "pdf") return <IconFileTypePdf className="h-5 w-5 text-red-400" />;
  if (ext === "doc") return <IconFileTypeDoc className="h-5 w-5 text-blue-400" />;
  if (ext === "docx") return <IconFileTypeDocx className="h-5 w-5 text-blue-400" />;
  if (ext === "xls" || ext === "xlsx")
    return <IconFileTypeXls className="h-5 w-5 text-emerald-500" />;
  return <IconFileText className="h-5 w-5 text-zinc-400" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FileUpload({
  carpeta,
  tiposPermitidos,
  maxSizeMB,
  multiple = false,
  onUploadComplete,
  archivosExistentes = [],
}: {
  carpeta: string;
  tiposPermitidos: string[];
  maxSizeMB: number;
  multiple?: boolean;
  onUploadComplete: (urls: string[]) => void;
  archivosExistentes?: string[];
}) {
  const [archivos, setArchivos] = useState<ArchivoItem[]>(() =>
    archivosExistentes.map((url) => ({ url, nombre: nombreDesdeUrl(url) }))
  );
  const [subiendo, setSubiendo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function procesarArchivos(lista: FileList | File[]) {
    const archivosSeleccionados = Array.from(lista);
    if (archivosSeleccionados.length === 0) return;

    const validos: File[] = [];
    for (const file of archivosSeleccionados) {
      if (tiposPermitidos.length > 0 && !tiposPermitidos.includes(file.type)) {
        toast.error(`"${file.name}" no es un tipo de archivo permitido.`);
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`"${file.name}" supera el tamaño máximo de ${maxSizeMB}MB.`);
        continue;
      }
      validos.push(file);
    }
    if (validos.length === 0) return;

    if (!multiple && validos.length > 1) {
      toast(`Solo se usará "${validos[0].name}"; esta sección admite un solo archivo.`);
    }
    const porSubir = multiple ? validos : validos.slice(0, 1);

    setSubiendo(true);
    try {
      // En modo single, reemplazamos: se borra el archivo anterior (best-effort).
      if (!multiple && archivos.length > 0) {
        await eliminarArchivo(archivos[0].url).catch(() => {});
      }

      const nuevos: ArchivoItem[] = [];
      for (const file of porSubir) {
        const url = await subirArchivo(file, carpeta);
        nuevos.push({ url, nombre: file.name, tamanoBytes: file.size });
      }

      const actualizado = multiple ? [...archivos, ...nuevos] : nuevos;
      setArchivos(actualizado);
      onUploadComplete(actualizado.map((a) => a.url));
      toast.success(
        nuevos.length > 1 ? "Archivos subidos correctamente" : "Archivo subido correctamente"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(indice: number) {
    const item = archivos[indice];
    try {
      await eliminarArchivo(item.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el archivo.");
      return;
    }
    const actualizado = archivos.filter((_, i) => i !== indice);
    setArchivos(actualizado);
    onUploadComplete(actualizado.map((a) => a.url));
    toast.success("Archivo eliminado");
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) procesarArchivos(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 ${
          dragOver ? "border-[var(--color-primario)] bg-[var(--color-primario)]/5" : "border-zinc-300 bg-zinc-50"
        }`}
      >
        <IconCloudUpload className="h-8 w-8 text-zinc-300" />
        <p className="text-xs text-zinc-400">Arrastra archivos aquí o</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Seleccionar archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={tiposPermitidos.join(",")}
          onChange={(e) => {
            if (e.target.files) procesarArchivos(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {subiendo && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-1/3 animate-upload-progress rounded-full bg-[var(--color-primario)]" />
        </div>
      )}

      {archivos.length > 0 && (
        <ul className="space-y-2">
          {archivos.map((archivo, indice) => (
            <li
              key={archivo.url}
              className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm"
            >
              {esImagen(archivo.nombre) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={archivo.url}
                  alt={archivo.nombre}
                  className="h-9 w-9 shrink-0 rounded object-cover"
                />
              ) : (
                <IconoArchivo nombre={archivo.nombre} />
              )}
              <span
                className="min-w-0 flex-1 truncate text-zinc-700"
                title={archivo.nombre}
              >
                {archivo.nombre}
              </span>
              {archivo.tamanoBytes && (
                <span className="shrink-0 text-xs text-zinc-400">
                  {formatTamano(archivo.tamanoBytes)}
                </span>
              )}
              <button
                type="button"
                onClick={() => eliminar(indice)}
                aria-label={`Quitar ${archivo.nombre}`}
                className="shrink-0 text-zinc-400 hover:text-red-500"
              >
                <IconX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
