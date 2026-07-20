"use client";

import { useState } from "react";
import { IconMail } from "@tabler/icons-react";
import ModalCorreo from "./ModalCorreo";
import type { TipoCorreo } from "@/src/lib/plantillasCorreo";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

export default function BotonEnviarCorreo({
  tipo,
  variables,
  destinatarios,
  codigoCliente,
  adjuntos,
  onEnviado,
  etiqueta = "Enviar correo",
}: {
  tipo: TipoCorreo;
  variables: Record<string, string>;
  destinatarios: string[];
  codigoCliente: string;
  adjuntos?: AdjuntoCorreo[];
  onEnviado?: () => void;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-50"
      >
        <IconMail className="h-4 w-4" />
        {etiqueta}
      </button>

      <ModalCorreo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        tipo={tipo}
        variables={variables}
        destinatarios={destinatarios}
        codigoCliente={codigoCliente}
        adjuntos={adjuntos}
        onEnviado={onEnviado}
      />
    </>
  );
}
