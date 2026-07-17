"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { IconLoader2, IconSend } from "@tabler/icons-react";
import { usePageTitle } from "@/app/_components/PageHeaderContext";
import { enviarCorreoPruebaAction } from "@/src/lib/emailPruebaActions";

export default function PruebaCorreoView() {
  usePageTitle("Prueba de Correo (temporal)");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleEnviar() {
    if (!email) {
      toast.error("Ingresa un correo destino");
      return;
    }
    setEnviando(true);
    const resultado = await enviarCorreoPruebaAction(email);
    setEnviando(false);
    if (resultado.exito) {
      toast.success("Correo enviado correctamente");
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Sección temporal para validar el envío de correos vía Microsoft Graph.
        Se eliminará una vez confirmado que funciona.
      </div>

      <div className="space-y-4 rounded-card border border-border bg-white p-6 shadow-card">
        <div>
          <label
            htmlFor="email-prueba"
            className="block text-sm font-medium text-zinc-700"
          >
            Correo destino
          </label>
          <input
            id="email-prueba"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="destino@correo.com"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          type="button"
          onClick={handleEnviar}
          disabled={enviando}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {enviando ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconSend className="h-4 w-4" />
          )}
          {enviando ? "Enviando..." : "Enviar correo de prueba"}
        </button>
      </div>
    </div>
  );
}
