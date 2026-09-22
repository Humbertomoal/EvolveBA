import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "archivos";

let clienteCacheado: SupabaseClient | null = null;

/**
 * Cliente de Supabase creado A DEMANDA, no al cargar el módulo.
 *
 * ── Por qué no es un `const` de módulo ─────────────────────────────────────
 * Antes este archivo creaba el cliente al evaluarse y LANZABA ahí mismo si
 * faltaban las variables de entorno. Cualquier página que arrastrara este
 * módulo —aunque no tocara Storage— reventaba al importarse, y en `next build`
 * eso sale como "Failed to collect page data for <ruta>" con el rastro apuntando
 * a un chunk `src_lib_*`, que se confunde con el bug de pg/util-types.
 *
 * El alcance creció al agregar `copiarArchivo`: lo importa `productos.ts`, que a
 * su vez lo importan las páginas del catálogo, así que el arranque de esas
 * páginas pasó a depender de dos variables que solo hacen falta para subir o
 * copiar archivos. Ya pasaba con `FileUpload` en el formulario de licitaciones.
 *
 * Con la creación diferida, el fallo aparece cuando de verdad se usa Storage
 * —con el mismo mensaje— y nunca al importar.
 */
function getSupabase(): SupabaseClient {
  if (clienteCacheado) return clienteCacheado;

  // Next sustituye estas expresiones en tiempo de compilación también dentro de
  // funciones, así que leerlas aquí no cambia nada para el cliente.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  clienteCacheado = createClient(supabaseUrl, supabaseAnonKey);
  return clienteCacheado;
}

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

  // TODO: quitar — logs temporales para diagnosticar el 404 al subir
  console.log("[diag] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("[diag] Bucket:", BUCKET);
  console.log("[diag] Path completo:", ruta);

  const { error } = await getSupabase().storage.from(BUCKET).upload(ruta, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.log("[diag] Error completo:", error);
    throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
  }

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(ruta);
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

/**
 * Copia un archivo del bucket a una ruta NUEVA en la misma carpeta y devuelve la
 * URL pública de la copia. El original no se toca.
 *
 * Existe para "duplicar material como base": el material nuevo debe ser dueño
 * de sus propios archivos. Si compartiera la URL del base, quitar la ficha en
 * cualquiera de los dos (FileUpload borra del Storage) rompería al otro.
 *
 * No usa `storage.copy()`: con la llave anónima falla con "Object not found",
 * porque las políticas del bucket no le dan SELECT sobre storage.objects. Se
 * descarga por la URL PÚBLICA y se vuelve a subir, que solo requiere el INSERT
 * que ya usa subirArchivo.
 */
export async function copiarArchivo(url: string): Promise<string> {
  const origen = extraerRutaDesdeUrl(url);
  if (!origen) {
    throw new Error("El archivo no pertenece al almacenamiento de la aplicación.");
  }

  const corte = origen.lastIndexOf("/");
  const carpeta = corte >= 0 ? origen.slice(0, corte) : "";
  // subirArchivo antepone `${Date.now()}-`; se quita para no apilar prefijos en
  // copias de copias. El sufijo aleatorio evita choques al copiar varias fichas
  // en el mismo milisegundo.
  const nombre = origen.slice(corte + 1).replace(/^\d+-/, "");
  const sufijo = Math.random().toString(36).slice(2, 8);
  const destino = `${carpeta ? `${carpeta}/` : ""}${Date.now()}-${sufijo}-${nombre}`;

  const respuesta = await fetch(url, { cache: "no-store" });
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer "${nombre}" (HTTP ${respuesta.status}).`);
  }
  const contenido = await respuesta.blob();

  const { error } = await getSupabase().storage.from(BUCKET).upload(destino, contenido, {
    cacheControl: "3600",
    upsert: false,
    contentType: respuesta.headers.get("content-type") ?? undefined,
  });
  if (error) {
    throw new Error(`No se pudo copiar "${nombre}": ${error.message}`);
  }

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(destino);
  if (!data?.publicUrl) {
    throw new Error(`No se pudo obtener la URL pública de la copia de "${nombre}".`);
  }
  return data.publicUrl;
}

/** Elimina un archivo del bucket a partir de su URL pública. */
export async function eliminarArchivo(url: string): Promise<void> {
  const ruta = extraerRutaDesdeUrl(url);
  if (!ruta) return;

  const { error } = await getSupabase().storage.from(BUCKET).remove([ruta]);
  if (error) {
    throw new Error(`No se pudo eliminar el archivo: ${error.message}`);
  }
}
