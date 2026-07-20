"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  IconAlertCircle,
  IconInfoCircle,
  IconLoader2,
  IconMail,
  IconPaperclip,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import {
  previsualizarCorreoAction,
  enviarCorreoAction,
} from "@/src/lib/correosActions";
import type { TipoCorreo } from "@/src/lib/plantillasCorreo";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

export default function ModalCorreo({
  abierto,
  onCerrar,
  tipo,
  variables,
  destinatarios,
  codigoCliente,
  adjuntos,
  onEnviado,
  aviso,
  variablesPorDestinatario,
  notaPersonalizacion,
}: {
  abierto: boolean;
  onCerrar: () => void;
  tipo: TipoCorreo;
  variables: Record<string, string>;
  destinatarios: string[];
  codigoCliente: string;
  adjuntos?: AdjuntoCorreo[];
  onEnviado?: () => void;
  /** Aviso adicional resaltado arriba del contenido (p.ej. advertencias sobre datos que no se pudieron recuperar). */
  aviso?: string;
  /**
   * Overrides por destinatario (email → { variable: valor }) para variables
   * que se personalizan por proveedor (p.ej. tablaMateriales). La vista
   * previa/edición muestra el texto renderizado con `variables` (el
   * destinatario de referencia); al enviar, cada destinatario recibe su
   * propio valor sustituido dentro del texto ya editado — ver
   * `enviarCorreoAction`.
   */
  variablesPorDestinatario?: Record<string, Record<string, string>>;
  /** Nota informativa mostrada arriba del cuerpo cuando hay personalización por destinatario. */
  notaPersonalizacion?: string;
}) {
  const [cargando, setCargando] = useState(true);
  const [asuntoOriginal, setAsuntoOriginal] = useState("");
  const [cuerpoOriginal, setCuerpoOriginal] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;
    setCargando(true);
    setError(null);

    previsualizarCorreoAction(tipo, variables, codigoCliente).then((resultado) => {
      if (cancelado) return;
      setCargando(false);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setAsuntoOriginal(resultado.asunto);
      setCuerpoOriginal(resultado.cuerpo);
      setAsunto(resultado.asunto);
      setCuerpo(resultado.cuerpo);
    });

    return () => {
      cancelado = true;
    };
    // Se re-renderiza cada vez que el modal se abre; variables/destinatarios
    // no entran a las deps a propósito para no re-disparar la carga mientras
    // el usuario edita el texto con el modal ya abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tipo, codigoCliente]);

  function handleRestaurar() {
    setAsunto(asuntoOriginal);
    setCuerpo(cuerpoOriginal);
  }

  async function handleEnviar() {
    if (destinatarios.length === 0) {
      toast.error("No hay destinatarios para este correo");
      return;
    }

    setEnviando(true);
    setError(null);

    const resultados = await Promise.all(
      destinatarios.map((para) =>
        enviarCorreoAction({
          tipo,
          para,
          asunto,
          cuerpo,
          codigoCliente,
          adjuntos,
          variablesBase: variablesPorDestinatario ? variables : undefined,
          variablesPorDestinatario,
        })
      )
    );

    setEnviando(false);

    const fallidos = resultados.filter(
      (r): r is { exito: false; error: string } => !r.exito
    );

    if (fallidos.length > 0) {
      const mensaje =
        fallidos.length === resultados.length
          ? `No se pudo enviar el correo: ${fallidos[0].error}`
          : `Se enviaron ${resultados.length - fallidos.length} de ${resultados.length} correos. Error: ${fallidos[0].error}`;
      setError(mensaje);
      toast.error(mensaje);
      return;
    }

    toast.success(
      destinatarios.length === 1 ? "Correo enviado" : `${destinatarios.length} correos enviados`
    );
    onEnviado?.();
    onCerrar();
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-card bg-white shadow-modal">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <IconMail className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-zinc-900">
              Vista previa del correo
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors duration-150 hover:text-zinc-700"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando ? (
            <div className="flex animate-pulse flex-col gap-3">
              <div className="h-4 w-1/3 rounded bg-zinc-100" />
              <div className="h-9 rounded bg-zinc-100" />
              <div className="h-4 w-1/4 rounded bg-zinc-100" />
              <div className="h-40 rounded bg-zinc-100" />
            </div>
          ) : (
            <div className="space-y-4">
              {aviso && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{aviso}</span>
                </div>
              )}

              {notaPersonalizacion && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notaPersonalizacion}</span>
                </div>
              )}

              {/* Para */}
              <div>
                <label className="block text-xs font-medium text-zinc-500">Para</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {destinatarios.length === 0 ? (
                    <span className="text-xs text-zinc-400">Sin destinatarios</span>
                  ) : (
                    destinatarios.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {d}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label
                  htmlFor="modal-correo-asunto"
                  className="block text-xs font-medium text-zinc-500"
                >
                  Asunto
                </label>
                <input
                  id="modal-correo-asunto"
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label
                  htmlFor="modal-correo-cuerpo"
                  className="block text-xs font-medium text-zinc-500"
                >
                  Mensaje
                </label>
                <textarea
                  id="modal-correo-cuerpo"
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  rows={12}
                  className="mt-1 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Adjuntos */}
              {adjuntos && adjuntos.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500">
                    Adjuntos
                  </label>
                  <div className="mt-1 flex flex-col gap-1">
                    {adjuntos.map((a) => (
                      <span
                        key={a.nombre}
                        className="flex items-center gap-1.5 text-sm text-zinc-600"
                      >
                        <IconPaperclip className="h-3.5 w-3.5 text-zinc-400" />
                        {a.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-400">
                Puedes editar el texto solo para este envío. La plantilla base
                no se modifica.
              </p>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={handleRestaurar}
            disabled={cargando || enviando}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors duration-150 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            Restaurar texto original
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEnviar}
              disabled={cargando || enviando}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando && <IconLoader2 className="h-4 w-4 animate-spin" />}
              {enviando ? "Enviando..." : "Enviar correo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
