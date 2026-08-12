// ─────────────────────────────────────────────────────────────────────────────
// Superficie de tarjeta del panel — Card + StatCard.
//
// Sin "use client" a propósito: no usa hooks ni handlers, así que funciona como
// Server Component y no manda nada al bundle del navegador.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// La misma superficie estaba escrita a mano en cada pantalla, y en dos dialectos
// que dan el MISMO píxel: la versión con tokens del theme
// (`rounded-card border-border shadow-card`) y la versión literal
// (`rounded-[10px] border-[#ede8e8] shadow-[0_1px_6px_rgba(0,0,0,0.07)]`, que
// sigue viva en TableroView). Los tokens están definidos en app/globals.css
// (@theme inline) y son la fuente única; esta tarjeta solo los envuelve.
//
// Este componente NO se aplicó retroactivamente al resto de las pantallas: el
// dashboard lo estrena y las demás se pueden migrar después, una por una.
// ─────────────────────────────────────────────────────────────────────────────

const SUPERFICIE = "rounded-card border border-border bg-white shadow-card";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${SUPERFICIE}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/**
 * Tarjeta de métrica: rótulo, cifra y una línea de contexto.
 *
 * `acento` la convierte en la protagonista del grid — borde y fondo teñidos con
 * el color del cliente (`--color-primario`, que el layout del comprador inyecta
 * desde src/config/clientes.ts) y la cifra más grande.
 */
export function StatCard({
  label,
  valor,
  subtexto,
  icon,
  acento = false,
  className,
  children,
}: {
  label: string;
  valor: string | number;
  subtexto?: React.ReactNode;
  icon?: React.ReactNode;
  acento?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-card border p-5 shadow-card transition-shadow duration-150 ease-out hover:shadow-md ${
        acento
          ? "border-primary/25 bg-primary-light"
          : "border-border bg-white"
      }${className ? ` ${className}` : ""}`}
    >
      {icon && (
        <span
          className={`absolute top-4 right-4 ${
            acento ? "text-primary/70" : "text-primary/40"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <p
        className={`pr-8 text-[11px] font-semibold tracking-wide uppercase ${
          acento ? "text-primary/80" : "text-zinc-400"
        }`}
      >
        {label}
      </p>

      {/* tabular-nums evita que las cifras "bailen" de ancho entre renders. */}
      <p
        className={`mt-2 font-semibold tabular-nums ${
          acento ? "text-4xl text-primary" : "text-3xl text-zinc-800"
        }`}
      >
        {valor}
      </p>

      {subtexto && (
        <p
          className={`mt-1 text-xs ${
            acento ? "text-primary/70" : "text-zinc-400"
          }`}
        >
          {subtexto}
        </p>
      )}

      {children}
    </div>
  );
}
