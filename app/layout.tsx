import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { getConfigEmpresa } from "@/src/config/empresa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fuente de la landing comercial (Evolve BA). Se expone como variable CSS y se
// aplica sólo donde se necesita (app/page.tsx), sin afectar al resto de la app.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  // Manrope llega hasta 800 en esta versión; los títulos que piden 900 caen al
  // peso más cercano (800), que sigue siendo bien marcado.
  weight: ["400", "500", "600", "700", "800"],
});

const empresa = getConfigEmpresa();

export const metadata: Metadata = {
  title: empresa.nombreComercial,
  description: `Plataforma de compras ${empresa.nombreComercial}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
