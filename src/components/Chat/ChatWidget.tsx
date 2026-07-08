"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import {
  getMensajes,
  enviarMensaje,
  marcarLeidos,
  type MensajeDTO,
} from "@/src/lib/chatActions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDia(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function mismodia(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatWidget({
  licitacionId,
  proveedorId,
  emisor,
  nombreProveedor,
}: {
  licitacionId: string;
  proveedorId: string;
  emisor: "comprador" | "proveedor";
  nombreProveedor: string;
}) {
  const [mensajes, setMensajes] = useState<MensajeDTO[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cargarMensajes = useCallback(
    async (indicator = false) => {
      if (indicator) setActualizando(true);
      const data = await getMensajes(licitacionId, proveedorId);
      setMensajes(data);
      if (indicator) setActualizando(false);
      await marcarLeidos(licitacionId, proveedorId, emisor);
    },
    [licitacionId, proveedorId, emisor]
  );

  // Load on mount
  useEffect(() => {
    cargarMensajes(false);
  }, [cargarMensajes]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Polling every 30 seconds
  useEffect(() => {
    const id = setInterval(() => cargarMensajes(true), 30_000);
    return () => clearInterval(id);
  }, [cargarMensajes]);

  async function handleEnviar() {
    const trimmed = texto.trim();
    if (!trimmed || enviando) return;
    setEnviando(true);
    setErrorMsg(null);
    const result = await enviarMensaje(licitacionId, proveedorId, emisor, trimmed);
    if (!result.ok) {
      setErrorMsg(result.error ?? "Error al enviar.");
      setEnviando(false);
      return;
    }
    setTexto("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await cargarMensajes(false);
    setEnviando(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  const header =
    emisor === "comprador"
      ? `Chat con ${nombreProveedor}`
      : "Chat con Comprador";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-800">{header}</h3>
        {actualizando && (
          <span className="text-xs text-zinc-400">Actualizando…</span>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 && (
          <p className="pt-8 text-center text-xs text-zinc-400">
            No hay mensajes todavía. ¡Sé el primero en escribir!
          </p>
        )}
        {mensajes.map((m, i) => {
          const esPropio = m.emisor === emisor;
          const prev = mensajes[i - 1];
          const showDate = !prev || !mismodia(prev.createdAt, m.createdAt);

          return (
            <div key={m.id}>
              {showDate && (
                <div className="flex justify-center py-2">
                  <span className="rounded-full bg-zinc-100 px-3 py-0.5 text-xs capitalize text-zinc-500">
                    {formatDia(m.createdAt)}
                  </span>
                </div>
              )}
              <div
                className={`flex ${esPropio ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    esPropio
                      ? "rounded-br-none bg-[var(--color-primario)] text-white"
                      : "rounded-bl-none bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.mensaje}
                  </p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      esPropio ? "text-white/60" : "text-zinc-400"
                    }`}
                  >
                    {formatHora(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-zinc-100 px-4 py-3">
        {errorMsg && (
          <p className="mb-2 text-xs text-red-500">{errorMsg}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Escribe un mensaje…"
            rows={1}
            maxLength={1000}
            disabled={enviando}
            className="flex-1 resize-none overflow-hidden rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !texto.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primario)] text-white transition-colors duration-150 hover:bg-[var(--color-secundario)] disabled:opacity-40"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-right text-[10px] text-zinc-400">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
