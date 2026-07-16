import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/prisma";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        console.log("=== AUTHORIZE INICIADO ===");
        console.log("Email:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log("ERROR: Credenciales vacías");
          return null;
        }

        try {
          const usuario = await prisma.usuario.findUnique({
            where: { email: credentials.email as string },
          });

          console.log("Usuario encontrado:", !!usuario);
          console.log("Activo:", usuario?.activo);
          console.log("Tiene password:", !!usuario?.password);
          console.log("Password en BD (primeros 10 chars):", usuario?.password?.substring(0, 10));

          if (!usuario || !usuario.activo || !usuario.password) {
            console.log("ERROR: Usuario inválido");
            return null;
          }

          const ok = await bcrypt.compare(
            credentials.password as string,
            usuario.password
          );
          console.log("bcrypt.compare resultado:", ok);

          if (!ok) {
            console.log("ERROR: Password incorrecto");
            return null;
          }

          console.log("=== LOGIN EXITOSO ===");
          return {
            id: usuario.id,
            email: usuario.email,
            name: `${(usuario as any).nombre ?? ""} ${(usuario as any).apellido ?? ""}`,
            tipoUsuario: (usuario as any).tipoUsuario ?? "comprador",
            primerAcceso: (usuario as any).primerAcceso ?? false,
            esAdmin: false,
          };
        } catch (error) {
          console.error("ERROR en authorize:", error);
          return null;
        }
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      async profile(profile, tokens) {
        // Microsoft Entra ID no siempre manda el claim "email" en el ID token
        // (depende de la config del tenant). Cuando falta, cae a
        // preferred_username o upn, que casi siempre están presentes.
        console.log("=== MICROSOFT PROFILE RAW ===", {
          email: profile.email,
          preferred_username: (profile as any).preferred_username,
          upn: (profile as any).upn,
        });

        const email = (
          profile.email ??
          (profile as any).preferred_username ??
          (profile as any).upn ??
          ""
        )
          .toLowerCase()
          .trim();

        let image: string | undefined;
        try {
          const response = await fetch(
            "https://graph.microsoft.com/v1.0/me/photos/48x48/$value",
            { headers: { Authorization: `Bearer ${tokens.access_token}` } }
          );
          if (response.ok) {
            const pictureBuffer = await response.arrayBuffer();
            image = `data:image/jpeg;base64, ${Buffer.from(pictureBuffer).toString("base64")}`;
          }
        } catch {
          // Foto de perfil es opcional, no debe bloquear el login
        }

        return {
          id: profile.sub,
          name: profile.name,
          email,
          image: image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      const email = (
        profile?.email ??
        (profile as any)?.preferred_username ??
        (profile as any)?.upn ??
        user.email ??
        ""
      )
        .toLowerCase()
        .trim();

      console.log("=== SIGNIN MICROSOFT ===", {
        "profile.email": profile?.email,
        "profile.preferred_username": (profile as any)?.preferred_username,
        "profile.upn": (profile as any)?.upn,
        "user.email": user.email,
        emailResuelto: email,
      });

      if (!email) return "/login?error=CuentaNoRegistrada";

      const usuario = await prisma.usuario.findUnique({ where: { email } });
      console.log("Usuario encontrado en BD:", !!usuario, usuario?.email);
      if (!usuario) return "/login?error=CuentaNoRegistrada";
      if (!usuario.activo) return "/login?error=CuentaInactiva";

      // Vinculación: guarda el microsoftId (oid u sub del token) si aún no lo tiene.
      const microsoftId =
        (profile as any)?.oid ?? (profile as any)?.sub ?? account.providerAccountId ?? null;

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          ...(usuario.microsoftId || !microsoftId ? {} : { microsoftId }),
          ultimoAcceso: new Date(),
        },
      });

      // Mismo mecanismo de cookies que usa el login por correo/contraseña
      // (varias partes de la app leen la identidad del comprador/proveedor
      // desde estas cookies, no solo desde la sesión de NextAuth).
      // tipoUsuario solo debe ser "comprador" o "proveedor". Cualquier otro
      // valor (p.ej. un nombre de rol guardado ahí por error) se trata como
      // comprador para no dejar al usuario sin cookie de panel asignada.
      const esProveedor = usuario.tipoUsuario === "proveedor";

      const cookieStore = await cookies();
      if (!esProveedor) {
        cookieStore.set("cyrgo_comprador_id", usuario.id, {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      } else {
        const proveedor = await prisma.proveedor.findFirst({
          where: { usuarioId: usuario.id },
          select: { id: true },
        });
        if (proveedor) {
          cookieStore.set("cyrgo_proveedor_id", proveedor.id, {
            path: "/",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
          });
        }
      }

      return esProveedor ? "/proveedor" : "/comprador";
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === "microsoft-entra-id" && token.email) {
        // Los logins de Microsoft no pasan por authorize(), así que el token
        // se completa aquí con los mismos datos que produce Credentials.
        const usuario = await prisma.usuario.findUnique({
          where: { email: (token.email as string).toLowerCase() },
          include: {
            rol: { select: { nombre: true, esAdmin: true, esSupervisor: true } },
            proveedor: { select: { id: true } },
          },
        });

        console.log("=== JWT MICROSOFT ===", {
          email: token.email,
          usuarioEncontrado: !!usuario,
          tipoUsuarioEnBD: (usuario as any)?.tipoUsuario,
        });

        if (usuario) {
          // tipoUsuario solo debe ser "comprador" o "proveedor" (define el panel).
          // Cualquier otro valor guardado por error (p.ej. el nombre de un rol
          // como "Administrador") se trata como comprador para no romper el login.
          const esProveedor = (usuario as any).tipoUsuario === "proveedor";

          token.id = usuario.id;
          token.tipoUsuario = esProveedor ? "proveedor" : "comprador";
          token.rolId = (usuario as any).rolId;
          token.rolNombre = (usuario as any).rol?.nombre ?? null;
          token.esAdmin = (usuario as any).rol?.esAdmin ?? false;
          token.esSupervisor = (usuario as any).rol?.esSupervisor ?? false;
          token.clienteId = (usuario as any).clienteId;
          token.proveedorId = (usuario as any).proveedor?.id ?? null;
          token.primerAcceso = false; // El SSO nunca exige cambio de contraseña

          console.log("=== JWT MICROSOFT: token final ===", {
            id: token.id,
            tipoUsuario: token.tipoUsuario,
            rolNombre: token.rolNombre,
            esAdmin: token.esAdmin,
            esSupervisor: token.esSupervisor,
            clienteId: token.clienteId,
            proveedorId: token.proveedorId,
          });
        }
      } else if (user) {
        token.id = user.id;
        token.tipoUsuario = (user as any).tipoUsuario;
        token.primerAcceso = (user as any).primerAcceso;
        token.esAdmin = (user as any).esAdmin;
      }
      if (trigger === "update" && session?.user) {
        Object.assign(token, session.user);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).tipoUsuario = token.tipoUsuario;
      (session.user as any).primerAcceso = token.primerAcceso;
      (session.user as any).esAdmin = token.esAdmin;
      (session.user as any).esSupervisor = token.esSupervisor;
      (session.user as any).rolId = token.rolId;
      (session.user as any).rolNombre = token.rolNombre;
      (session.user as any).clienteId = token.clienteId;
      (session.user as any).proveedorId = token.proveedorId;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
