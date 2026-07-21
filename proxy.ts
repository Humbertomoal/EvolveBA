import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";

const PUBLIC_PATHS = ["/login", "/cambiar-password"];
const SECCIONES_SIN_CLIENTE = ["/comprador", "/proveedor", "/inicio"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // La raíz debe ser pública SOLO en coincidencia exacta ("/"), nunca como
  // prefijo — de lo contrario "/comprador", "/proveedor", etc. (que también
  // empiezan con "/") quedarían públicos. Por eso va aparte del array
  // PUBLIC_PATHS (cuyas entradas sí matchean como prefijo, vía startsWith).
  const esRaiz = pathname === "/";
  const isPublic =
    esRaiz ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  console.log("=== PROXY ===", {
    pathname,
    isPublic,
    hayAuth: !!req.auth,
    tipoUsuario: (req.auth?.user as any)?.tipoUsuario,
    primerAcceso: (req.auth?.user as any)?.primerAcceso,
  });

  if (!isPublic) {
    if (!req.auth) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const primerAcceso = (req.auth.user as any)?.primerAcceso;
    if (primerAcceso && !pathname.startsWith("/cambiar-password")) {
      return NextResponse.redirect(new URL("/cambiar-password", nextUrl));
    }
  }

  const esSeccionSinCliente = SECCIONES_SIN_CLIENTE.some(
    (seccion) => pathname === seccion || pathname.startsWith(`${seccion}/`)
  );

  if (esSeccionSinCliente) {
    return NextResponse.rewrite(
      new URL(`/${CODIGO_CLIENTE_SIN_ESPECIFICAR}${pathname}`, nextUrl)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // api/auth queda excluido a propósito: el wrapper auth() NUNCA debe
    // envolver las rutas de Auth.js (en especial el callback OAuth), porque
    // eso hace que Auth.js procese la misma request dos veces (una vez aquí,
    // otra en el route handler real) y corrompe cookies con estado como
    // pkceCodeVerifier — causaba "InvalidCheck: pkceCodeVerifier value could
    // not be parsed" en el login con Microsoft.
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
