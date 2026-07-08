"use client";

import { useActionState, useState } from "react";
import {
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconLock,
  IconMail,
} from "@tabler/icons-react";
import { loginAction } from "../actions";

const INPUT =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm rounded-card border border-border bg-white p-8 shadow-modal">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          E
        </div>
        <h1 className="mt-3 text-lg font-semibold text-zinc-800">Evolve BA</h1>
        <p className="mt-1 text-sm text-zinc-400">Inicia sesión para continuar</p>
      </div>

      <form action={action} className="space-y-4">
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
              autoComplete="email"
              placeholder="correo@empresa.com"
              className={INPUT}
            />
          </div>
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

        {error && (
          <div className="flex animate-fade-in-up items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-dark disabled:opacity-60"
        >
          {pending && <IconLoader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Iniciando sesión..." : "Entrar"}
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
    </div>
  );
}
