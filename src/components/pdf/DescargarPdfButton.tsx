"use client";

import { useState } from "react";
import { IconFileDownload } from "@tabler/icons-react";
import toast from "react-hot-toast";

/** Botón genérico para generar y descargar cualquiera de los PDFs del sistema. */
export default function DescargarPdfButton({
  accion,
  label = "Descargar PDF",
  className,
}: {
  accion: () => Promise<{ base64: string; filename: string }>;
  label?: string;
  className?: string;
}) {
  const [generando, setGenerando] = useState(false);

  async function handleClick() {
    setGenerando(true);
    try {
      const { base64, filename } = await accion();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={generando}
      className={
        className ??
        "flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      <IconFileDownload className="h-4 w-4" />
      {generando ? "Generando PDF…" : label}
    </button>
  );
}
