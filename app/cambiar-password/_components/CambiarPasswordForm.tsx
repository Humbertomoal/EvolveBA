"use client";

import { useActionState, useState } from "react";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";
import { cambiarPasswordAction } from "../actions";

export default function CambiarPasswordForm({ nombre }: { nombre: string }) {
  const [state, action, pending] = useActionState(cambiarPasswordAction, null);
  const [show, setShow] = useState(false);

  return (
    <div className="w-full max-w-sm rounded-[10px] border border-[#ede8e8] bg-white p-8 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Cambia tu contraseña</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Hola {nombre}, debes establecer una nueva contraseña para continuar.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label
            htmlFor="nuevaPassword"
            className="block text-sm font-medium text-zinc-700"
          >
            Nueva contraseña
          </label>
          <div className="relative mt-1">
            <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="nuevaPassword"
              name="nuevaPassword"
              type={show ? "text" : "password"}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {show ? (
                <IconEyeOff className="h-4 w-4" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmarPassword"
            className="block text-sm font-medium text-zinc-700"
          >
            Confirmar contraseña
          </label>
          <div className="relative mt-1">
            <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="confirmarPassword"
              name="confirmarPassword"
              type={show ? "text" : "password"}
              required
              minLength={8}
              placeholder="Repite la contraseña"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Establecer contraseña"}
        </button>
      </form>
    </div>
  );
}
