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
import { renderizarFirma, type TipoCorreo } from "@/src/lib/plantillasCorreo";
import type { AdjuntoCorreo } from "@/src/lib/emailService";

/**
 * Un adjunto en el preview, con botón para quitarlo/restaurarlo. No se elimina
 * de la lista al quitarlo: se tacha, para que el comprador vea qué descartó y
 * pueda deshacerlo sin reabrir el modal.
 */
function FilaAdjunto({
  nombre,
  quitado,
  onAlternar,
}: {
  nombre: string;
  quitado: boolean;
  onAlternar: () => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <IconPaperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span
        className={`flex-1 truncate ${
          quitado ? "text-zinc-400 line-through" : "text-zinc-600"
        }`}
        title={nombre}
      >
        {nombre}
      </span>
      <button
        type="button"
        onClick={onAlternar}
        className="shrink-0 rounded px-1 text-xs text-zinc-400 hover:text-zinc-700"
        title={quitado ? "Volver a incluir" : "Quitar de este envío"}
      >
        {quitado ? "Incluir" : <IconX className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export default function ModalCorreo({
  abierto,
  onCerrar,
  tipo,
  variables = {},
  destinatarios,
  codigoCliente,
  adjuntos,
  onEnviado,
  aviso,
  adjuntosPorDestinatario,
  variablesPorDestinatario,
  notaPersonalizacion,
  tituloModal,
  permitirEditarDestinatarios = false,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Si se omite, el modal arranca en modo libre: sin plantilla, asunto/cuerpo vacíos (con la firma ya puesta). */
  tipo?: TipoCorreo;
  variables?: Record<string, string>;
  destinatarios: string[];
  codigoCliente: string;
  /** Adjuntos que recibe TODO destinatario (p.ej. documentos de la licitación). */
  adjuntos?: AdjuntoCorreo[];
  /**
   * Adjuntos propios de cada destinatario (email → archivos), p.ej. las fichas
   * técnicas de los materiales que ESE proveedor puede cotizar. Se suman a
   * `adjuntos` al enviar; cada quien recibe solo los suyos.
   */
  adjuntosPorDestinatario?: Record<string, AdjuntoCorreo[]>;
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
  /** Título del header del modal. Si se omite, usa el título por defecto. */
  tituloModal?: string;
  /**
   * Permite agregar/quitar destinatarios desde el preview. Default FALSE: los
   * flujos existentes (invitación, ganadores) siguen en solo lectura.
   *
   * OJO al activarlo: `adjuntosPorDestinatario` y `variablesPorDestinatario`
   * están indexados POR CORREO, así que un destinatario agregado a mano no
   * tiene entrada en esos mapas y recibiría el correo sin fichas propias y con
   * las variables base. Solo debe activarse en correos SIN personalización por
   * destinatario (hoy: ALTA_PROVEEDOR).
   */
  permitirEditarDestinatarios?: boolean;
}) {
  const [cargando, setCargando] = useState(true);
  const [asuntoOriginal, setAsuntoOriginal] = useState("");
  const [cuerpoOriginal, setCuerpoOriginal] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Adjuntos que el comprador quitó antes de enviar, por clave de archivo.
  // Quitar es POR ARCHIVO: si una ficha la comparten varios proveedores, se
  // quita para todos (evita una matriz archivo × proveedor en el modal).
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [fichasVisibles, setFichasVisibles] = useState(false);
  // Lista VIGENTE de destinatarios. La prop `destinatarios` es solo el valor
  // inicial; con permitirEditarDestinatarios el comprador la modifica y el
  // envío usa este estado. Sin la prop activa, se mantiene igual a la prop.
  const [destinatariosVigentes, setDestinatariosVigentes] = useState<string[]>(destinatarios);
  const [nuevoDestinatario, setNuevoDestinatario] = useState("");
  const [errorDestinatario, setErrorDestinatario] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;

    // Cada apertura arranca con todos los adjuntos incluidos: lo que se quitó
    // en un envío anterior no debe arrastrarse al siguiente.
    setQuitados(new Set());
    setFichasVisibles(false);
    // Los destinatarios se resiembran desde la prop por la misma razón: una
    // edición previa no debe arrastrarse, y así el modo solo-lectura queda
    // siempre exactamente igual a la prop.
    setDestinatariosVigentes(destinatarios);
    setNuevoDestinatario("");
    setErrorDestinatario(null);

    // Modo libre (sin tipo): no hay plantilla que previsualizar — arranca
    // con asunto vacío y el cuerpo listo con la firma estándar al final.
    if (!tipo) {
      const cuerpoInicial = `\n\n${renderizarFirma(codigoCliente)}`;
      setCargando(false);
      setError(null);
      setAsuntoOriginal("");
      setCuerpoOriginal(cuerpoInicial);
      setAsunto("");
      setCuerpo(cuerpoInicial);
      return;
    }

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

  // Llave estable de un adjunto: la URL de origen si existe (dos productos
  // pueden tener fichas con el mismo nombre de archivo), si no el nombre.
  function claveAdjunto(a: AdjuntoCorreo): string {
    return a.url ?? a.nombre;
  }

  function alternarQuitado(clave: string) {
    setQuitados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  const comunesVigentes = (adjuntos ?? []).filter(
    (a) => !quitados.has(claveAdjunto(a))
  );
  // Destinatarios que tienen fichas propias, para el bloque agrupado.
  const gruposFichas = Object.entries(adjuntosPorDestinatario ?? {}).filter(
    ([, archivos]) => archivos.length > 0
  );
  const totalFichas = gruposFichas.reduce((n, [, archivos]) => n + archivos.length, 0);
  const fichasQuitadas = gruposFichas.reduce(
    (n, [, archivos]) => n + archivos.filter((a) => quitados.has(claveAdjunto(a))).length,
    0
  );

  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function agregarDestinatario() {
    const correo = nuevoDestinatario.trim().toLowerCase();
    if (!correo) return;
    if (!RE_CORREO.test(correo)) {
      setErrorDestinatario("Ese no parece un correo válido.");
      return;
    }
    // Duplicado sin distinguir mayúsculas: los correos no son case-sensitive
    // en la práctica y dos chips iguales enviarían el mismo correo dos veces.
    if (destinatariosVigentes.some((d) => d.toLowerCase() === correo)) {
      setErrorDestinatario("Ese destinatario ya está en la lista.");
      return;
    }
    setDestinatariosVigentes((prev) => [...prev, correo]);
    setNuevoDestinatario("");
    setErrorDestinatario(null);
  }

  function quitarDestinatario(correo: string) {
    setDestinatariosVigentes((prev) => prev.filter((d) => d !== correo));
    setErrorDestinatario(null);
  }

  async function handleEnviar() {
    if (destinatariosVigentes.length === 0) {
      toast.error("No hay destinatarios para este correo");
      return;
    }

    setEnviando(true);
    setError(null);

    const resultados = await Promise.all(
      destinatariosVigentes.map((para) => {
        // Comunes + los propios de este destinatario, menos los que el
        // comprador quitó en el preview.
        const propios = (adjuntosPorDestinatario?.[para] ?? []).filter(
          (a) => !quitados.has(claveAdjunto(a))
        );
        return enviarCorreoAction({
          tipo,
          para,
          asunto,
          cuerpo,
          codigoCliente,
          adjuntos: [...comunesVigentes, ...propios],
          variablesBase: variablesPorDestinatario ? variables : undefined,
          variablesPorDestinatario,
        });
      })
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
      destinatariosVigentes.length === 1
        ? "Correo enviado"
        : `${destinatariosVigentes.length} correos enviados`
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
              {tituloModal ?? (tipo ? "Vista previa del correo" : "Redactar correo")}
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
                  {destinatariosVigentes.length === 0 ? (
                    <span className="text-xs text-zinc-400">Sin destinatarios</span>
                  ) : (
                    destinatariosVigentes.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {d}
                        {permitirEditarDestinatarios && (
                          <button
                            type="button"
                            onClick={() => quitarDestinatario(d)}
                            disabled={enviando}
                            aria-label={`Quitar ${d}`}
                            title={`Quitar ${d}`}
                            className="text-zinc-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {permitirEditarDestinatarios && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={nuevoDestinatario}
                        onChange={(e) => {
                          setNuevoDestinatario(e.target.value);
                          setErrorDestinatario(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            // Enter agrega el destinatario, no envía el correo.
                            e.preventDefault();
                            agregarDestinatario();
                          }
                        }}
                        placeholder="Agregar otro correo…"
                        disabled={enviando}
                        className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={agregarDestinatario}
                        disabled={enviando || !nuevoDestinatario.trim()}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Agregar
                      </button>
                    </div>
                    {errorDestinatario && (
                      <p className="mt-1 text-xs text-red-600">{errorDestinatario}</p>
                    )}
                  </div>
                )}
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

              {/* Adjuntos comunes: van a todos los destinatarios */}
              {adjuntos && adjuntos.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500">
                    {gruposFichas.length > 0 ? "Adjuntos para todos" : "Adjuntos"}
                  </label>
                  <div className="mt-1 flex flex-col gap-1">
                    {adjuntos.map((a) => (
                      <FilaAdjunto
                        key={claveAdjunto(a)}
                        nombre={a.nombre}
                        quitado={quitados.has(claveAdjunto(a))}
                        onAlternar={() => alternarQuitado(claveAdjunto(a))}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Fichas técnicas: personalizadas por proveedor */}
              {gruposFichas.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setFichasVisibles((v) => !v)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <label className="block cursor-pointer text-xs font-medium text-zinc-500">
                      Fichas técnicas ({totalFichas - fichasQuitadas} de {totalFichas}
                      {totalFichas === 1 ? " archivo" : " archivos"}, por proveedor)
                    </label>
                    <span className="text-xs text-zinc-400">
                      {fichasVisibles ? "Ocultar" : "Ver"}
                    </span>
                  </button>
                  {fichasVisibles && (
                    <div className="mt-1.5 flex flex-col gap-2">
                      {gruposFichas.map(([correo, archivos]) => (
                        <div key={correo}>
                          <p className="text-[11px] text-zinc-400">{correo}</p>
                          <div className="mt-0.5 flex flex-col gap-1">
                            {archivos.map((a) => (
                              <FilaAdjunto
                                key={`${correo}-${claveAdjunto(a)}`}
                                nombre={a.nombre}
                                quitado={quitados.has(claveAdjunto(a))}
                                onAlternar={() => alternarQuitado(claveAdjunto(a))}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-zinc-400">
                        Cada proveedor recibe solo las fichas de los materiales que
                        puede cotizar. Quitar un archivo lo quita para todos.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {tipo
                  ? "Puedes editar el texto solo para este envío. La plantilla base no se modifica."
                  : "Correo libre, sin plantilla. La firma ya está lista al final del cuerpo."}
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
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
          {tipo && (
            <button
              type="button"
              onClick={handleRestaurar}
              disabled={cargando || enviando}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors duration-150 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Restaurar texto original
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
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
