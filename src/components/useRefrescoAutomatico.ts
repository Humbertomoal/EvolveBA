"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantiene fresca una vista servida por un Server Component.
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 * Las pantallas de licitación en proceso son Server Components: se renderizan
 * UNA vez al navegar y quedan como una foto. Nada las vuelve a consultar, así
 * que el comprador no ve llegar las ofertas y —peor— el proveedor puede seguir
 * viendo la ronda N cuando el servidor ya avanzó a la N+1, y cotizar creyendo
 * una cosa mientras su oferta cae en otra ronda.
 *
 * `router.refresh()` re-ejecuta el Server Component y React RECONCILIA el
 * resultado: los componentes cliente conservan su estado local, así que lo que
 * el proveedor esté tecleando NO se pierde. Lo que sí se actualiza son las
 * props que bajan del servidor (rondaActual, esperandoDecision, rondaFinMs…).
 *
 * ── Por qué no realtime ────────────────────────────────────────────────────
 * Supabase Realtime exigiría abrir el acceso de `anon` al schema public, que
 * hoy está cerrado a nivel de grants. Con rondas de 10 minutos, 20 s de
 * latencia son irrelevantes y no justifican ampliar esa superficie.
 */
export function useRefrescoAutomatico(
  activo: boolean,
  intervaloMs: number = 20_000
) {
  // `router` puede ir en las deps del efecto sin miedo: useRouter() devuelve
  // publicAppRouterInstance, un singleton de módulo que el Provider entrega tal
  // cual, así que la referencia nunca cambia. Si cambiara, el efecto se
  // remontaría en cada render y el intervalo se reiniciaría antes de cumplir
  // los 20 s — no dispararía nunca, sin error ni pista.
  const router = useRouter();

  useEffect(() => {
    if (!activo) return;

    const refrescar = () => router.refresh();

    const timerId = setInterval(refrescar, intervaloMs);

    // Volver a la pestaña es el momento en que el desfase es mayor: los timers
    // de fondo se estrangulan, así que se refresca de inmediato al recuperar
    // el foco en vez de esperar al siguiente tick.
    const alRecuperarFoco = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alRecuperarFoco);
    window.addEventListener("focus", refrescar);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", alRecuperarFoco);
      window.removeEventListener("focus", refrescar);
    };
  }, [activo, intervaloMs, router]);
}
