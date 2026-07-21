"use client";

import { useState } from "react";
import { IconMail } from "@tabler/icons-react";
import ModalCorreo from "./ModalCorreo";
import type { TipoCorreo } from "@/src/lib/plantillasCorreo";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

export default function BotonEnviarCorreo({
  tipo,
  variables = {},
  destinatarios,
  codigoCliente,
  adjuntos,
  onEnviado,
  etiqueta = "Enviar correo",
  aviso,
  deshabilitado = false,
  tooltipDeshabilitado,
  soloIcono = false,
}: {
  /** Si se omite, el correo se abre en modo libre (sin plantilla) — ver ModalCorreo. */
  tipo?: TipoCorreo;
  variables?: Record<string, string>;
  destinatarios: string[];
  codigoCliente: string;
  adjuntos?: AdjuntoCorreo[];
  onEnviado?: () => void;
  etiqueta?: string;
  /** Aviso adicional resaltado dentro del modal (ver ModalCorreo). */
  aviso?: string;
  deshabilitado?: boolean;
  tooltipDeshabilitado?: string;
  /** Ícono solo (sin texto), para columnas de acciones en tablas — mismo patrón que los demás íconos de acción. */
  soloIcono?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {soloIcono ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={deshabilitado}
          title={deshabilitado ? tooltipDeshabilitado : etiqueta}
          aria-label={etiqueta}
          className="rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconMail className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={deshabilitado}
          title={deshabilitado ? tooltipDeshabilitado : undefined}
          className="flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconMail className="h-4 w-4" />
          {etiqueta}
        </button>
      )}

      <ModalCorreo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        tipo={tipo}
        variables={variables}
        destinatarios={destinatarios}
        codigoCliente={codigoCliente}
        adjuntos={adjuntos}
        onEnviado={onEnviado}
        aviso={aviso}
      />
    </>
  );
}
