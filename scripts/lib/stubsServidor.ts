/**
 * Stubs para llamar server actions REALES desde un script (fuera de Next.js).
 *
 * Una server action depende de dos cosas que solo existen dentro de una
 * petición de Next:
 *   · `@/src/auth` (NextAuth): `auth()` lee las cookies de la petición.
 *   · `next/cache`: `revalidatePath` necesita el runtime de Next.
 *
 * `instalarStubsServidor` intercepta esos dos módulos en el cargador de
 * CommonJS (tsx compila los .ts del proyecto a CJS: package.json no declara
 * "type": "module"). Por eso hay que llamarla ANTES de cargar la acción y
 * cargar la acción con `require`, no con `import` estático: los imports
 * estáticos se resuelven antes de que corra cualquier línea del script.
 *
 * `auth()` devuelve una sesión con el id de un Usuario REAL. Las acciones lo
 * vuelven a validar en la base (exigirCompradorSesion: activo, tipo interno),
 * así que el stub no salta ninguna regla de negocio: solo sustituye la
 * cookie por un id explícito.
 *
 * `verificarQueNoSeCargoLoReal()` comprueba al final que ni NextAuth ni
 * next/cache reales llegaron a cargarse por otra ruta (un import relativo, por
 * ejemplo). Si se cargaron, los stubs no cubrieron todo y el script debe
 * tratarlo como error.
 */
import Module from "node:module";
import { resolve } from "node:path";

const RUTA_AUTH = resolve(__dirname, "../../src/auth.ts");

type CargadorCJS = (request: string, parent: unknown, isMain: boolean) => unknown;

export function instalarStubsServidor(usuarioId: string): void {
  const M = Module as unknown as {
    _load: CargadorCJS;
    _resolveFilename: (request: string, parent: unknown, ...resto: unknown[]) => string;
  };
  const cargaOriginal = M._load;

  const stubAuth = {
    auth: async () => ({ user: { id: usuarioId } }),
    signIn: async () => {
      throw new Error("signIn no está disponible en un script");
    },
    signOut: async () => {
      throw new Error("signOut no está disponible en un script");
    },
    unstable_update: async () => null,
    handlers: {},
  };
  const stubCache = {
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <F>(f: F) => f,
  };

  M._load = function (this: unknown, request: string, parent: unknown, isMain: boolean) {
    if (request === "next/cache") return stubCache;
    if (request === "@/src/auth") return stubAuth;
    // Cualquier otra forma de llegar a src/auth.ts (ruta relativa).
    if (request.endsWith("/auth") || request.endsWith("/auth.ts")) {
      try {
        if (M._resolveFilename(request, parent) === RUTA_AUTH) return stubAuth;
      } catch {
        // No resolvió: que lo maneje el cargador normal.
      }
    }
    return cargaOriginal.call(this, request, parent, isMain);
  } as CargadorCJS;
}

/** Lanza si NextAuth o next/cache reales se cargaron pese a los stubs. */
export function verificarQueNoSeCargoLoReal(): void {
  const cargados = Object.keys(require.cache).filter(
    (ruta) =>
      ruta === RUTA_AUTH ||
      /[\\/]node_modules[\\/]next-auth[\\/]/.test(ruta) ||
      /[\\/]node_modules[\\/]next[\\/]dist[\\/]server[\\/]web[\\/]spec-extension[\\/]revalidate/.test(ruta)
  );
  if (cargados.length > 0) {
    throw new Error(
      "Los stubs no cubrieron todo: se cargaron módulos reales de auth/cache:\n  " +
        cargados.join("\n  ")
    );
  }
}
