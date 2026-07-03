import { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";

const PUBLIC_PATHS = ["/login", "/cambiar-password", "/api/auth"];
const SECCIONES_SIN_CLIENTE = ["/comprador", "/proveedor", "/inicio"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

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
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
