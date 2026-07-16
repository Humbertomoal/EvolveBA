"use client";

import { useActionState, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconLock,
  IconMail,
} from "@tabler/icons-react";
import { loginAction, verificarMetodoAcceso } from "../actions";

const INPUT =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

type Paso = "correo" | "password" | "redirigiendo";

export default function LoginForm({
  errorMicrosoft = null,
}: {
  errorMicrosoft?: string | null;
}) {
  const [error, action, pending] = useActionState(loginAction, null);

  const [paso, setPaso] = useState<Paso>("correo");
  const [email, setEmail] = useState("");
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verificando, startVerificacion] = useTransition();

  const mensajeError = error;

  function handleContinuar(e: React.FormEvent) {
    e.preventDefault();
    setErrorCorreo(null);

    const correo = email.trim().toLowerCase();
    if (!correo) return;

    startVerificacion(async () => {
      const resultado = await verificarMetodoAcceso(correo);

      if (resultado.metodo === "no_encontrado") {
        setErrorCorreo(resultado.mensaje);
        return;
      }

      if (resultado.metodo === "microsoft") {
        setPaso("redirigiendo");
        await signIn("microsoft-entra-id", undefined, { login_hint: correo });
        return;
      }

      setPaso("password");
    });
  }

  function handleUsarOtroCorreo() {
    setPaso("correo");
    setErrorCorreo(null);
    setShowPassword(false);
  }

  return (
    <div className="w-full max-w-sm rounded-card border border-border bg-white p-8 shadow-modal">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          E
        </div>
        <h1 className="mt-3 text-lg font-semibold text-zinc-800">Evolve BA</h1>
        <p className="mt-1 text-sm text-zinc-400">Inicia sesión para continuar</p>
      </div>

      {paso === "redirigiendo" && (
        <div className="flex animate-fade-in-up flex-col items-center gap-3 py-6 text-center">
          <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-zinc-600">
            Te redirigiremos a Microsoft para iniciar sesión…
          </p>
        </div>
      )}

      {paso === "correo" && (
        <form onSubmit={handleContinuar} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700"
            >
              Correo electrónico
            </label>
            <div className="relative mt-1">
              <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {(errorCorreo || errorMicrosoft) && (
            <div className="flex animate-fade-in-up items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorCorreo ?? errorMicrosoft}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verificando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verificando && <IconLoader2 className="h-4 w-4 animate-spin" />}
            {verificando ? "Verificando…" : "Continuar"}
          </button>
        </form>
      )}

      {paso === "password" && (
        <form action={action} className="animate-fade-in-up space-y-4">
          <input type="hidden" name="email" value={email.trim().toLowerCase()} />

          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
            <div className="flex items-center gap-2 truncate text-sm text-zinc-700">
              <IconMail className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="truncate">{email.trim()}</span>
            </div>
            <button
              type="button"
              onClick={handleUsarOtroCorreo}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:text-primary-dark"
            >
              <IconArrowLeft className="h-3 w-3" />
              Usar otro correo
            </button>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700"
            >
              Contraseña
            </label>
            <div className="relative mt-1">
              <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${INPUT} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors duration-150 hover:text-zinc-600"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {mensajeError && (
            <div className="flex animate-fade-in-up items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mensajeError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-dark disabled:opacity-60"
          >
            {pending && <IconLoader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-zinc-400 transition-colors duration-150 hover:text-primary"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
