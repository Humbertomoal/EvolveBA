import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET = "archivos";

function sanitizarNombre(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  const base = punto > 0 ? nombre.slice(0, punto) : nombre;
  const extension = punto > 0 ? nombre.slice(punto).toLowerCase() : "";
  const baseSana = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${baseSana || "archivo"}${extension}`;
}

/**
 * Sube un archivo al bucket "archivos" dentro de la carpeta indicada
 * (ej. "productos/imagenes") con un nombre único, y devuelve su URL pública.
 */
export async function subirArchivo(file: File, carpeta: string): Promise<string> {
  const nombreUnico = `${Date.now()}-${sanitizarNombre(file.name)}`;
  const ruta = `${carpeta.replace(/^\/|\/$/g, "")}/${nombreUnico}`;

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  if (!data?.publicUrl) {
    throw new Error(`No se pudo obtener la URL pública de "${file.name}".`);
  }
  return data.publicUrl;
}

/** Extrae la ruta dentro del bucket a partir de una URL pública de Supabase Storage. */
function extraerRutaDesdeUrl(url: string): string | null {
  const marcador = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marcador);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marcador.length));
}

/** Elimina un archivo del bucket a partir de su URL pública. */
export async function eliminarArchivo(url: string): Promise<void> {
  const ruta = extraerRutaDesdeUrl(url);
  if (!ruta) return;

  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) {
    throw new Error(`No se pudo eliminar el archivo: ${error.message}`);
  }
}
