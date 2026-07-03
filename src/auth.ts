import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
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
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
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
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});