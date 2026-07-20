import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
