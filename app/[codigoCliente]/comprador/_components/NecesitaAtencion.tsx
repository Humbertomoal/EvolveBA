import Link from "next/link";
import {
  IconChevronRight,
  IconClockExclamation,
  IconGavel,
  IconTruckDelivery,
  IconUserCheck,
} from "@tabler/icons-react";
import CountdownTimer from "@/src/components/CountdownTimer";
import EmptyState from "@/src/components/EmptyState";
import {
  type BloqueAtencion,
  type IconoAtencion,
  type TonoAtencion,
} from "@/src/lib/dashboardTypes";

/**
 * Mapa EXPLÍCITO de ícono lógico → componente. Deliberadamente no es un lookup
 * dinámico sobre el índice de @tabler/icons-react (como hace EmptyState): así el
 * bundler puede sacudir el árbol y solo entran estos cuatro íconos.
 */
const ICONOS: Record<IconoAtencion, React.ComponentType<{ className?: string }>> = {
  decision: IconGavel,
  asignar: IconUserCheck,
  ronda: IconClockExclamation,
  orden: IconTruckDelivery,
};

const TONOS: Record<TonoAtencion, { chip: string; badge: string }> = {
  ambar: { chip: "bg-amber-50 text-amber-600", badge: "bg-amber-100 text-amber-700" },
  azul: { chip: "bg-blue-50 text-blue-600", badge: "bg-blue-100 text-blue-700" },
  rojo: { chip: "bg-red-50 text-red-600", badge: "bg-red-100 text-red-700" },
  neutral: { chip: "bg-zinc-100 text-zinc-500", badge: "bg-zinc-200 text-zinc-700" },
};

export default function NecesitaAtencion({
  bloques,
}: {
  bloques: BloqueAtencion[];
}) {
  const totalPendientes = bloques.reduce((suma, b) => suma + b.total, 0);

  if (totalPendientes === 0) {
    return (
      <EmptyState
        icon="IconCircleCheck"
        title="Todo al día"
        description="No hay licitaciones esperando decisión, rondas por vencer ni órdenes sin enviar."
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      {bloques.map((bloque) => {
        const Icono = ICONOS[bloque.icono];
        const tono = TONOS[bloque.tono];
        const restantes = bloque.total - bloque.items.length;

        return (
          <div key={bloque.clave} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tono.chip}`}
              >
                <Icono className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-700">
                {bloque.titulo}
              </h3>
              {bloque.total > 0 && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tono.badge}`}
                >
                  {bloque.total}
                </span>
              )}
            </div>

            {bloque.total === 0 ? (
              <p className="mt-1.5 pl-9 text-xs text-zinc-400">{bloque.vacio}</p>
            ) : (
              <ul className="mt-1.5 space-y-0.5">
                {bloque.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1">
                        {/* El identificador NUNCA se trunca (shrink-0): sin
                            eso el número de orden se cortaba en "OC-DMY-0…"
                            para dejarle sitio a la razón social, que es
                            justo el dato prescindible de la fila. */}
                        <span className="flex items-baseline gap-1.5">
                          <span className="shrink-0 text-sm font-medium text-zinc-800">
                            {item.titulo}
                          </span>
                          {item.subtitulo && (
                            <span className="truncate text-[11px] text-zinc-400">
                              {item.subtitulo}
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-0.5 flex items-center gap-1 text-xs ${
                            item.urgente ? "text-red-600" : "text-zinc-400"
                          }`}
                        >
                          {item.detalle}
                          {/* Solo el bloque de rondas manda fechaLimite: ahí el
                              dato útil es cuánto FALTA, y tiene que correr en
                              vivo (el server render envejece en segundos). */}
                          {item.fechaLimite && (
                            <CountdownTimer
                              fechaFin={item.fechaLimite}
                              className="text-xs"
                            />
                          )}
                        </span>
                      </span>
                      <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-colors duration-150 ease-out group-hover:text-primary" />
                    </Link>
                  </li>
                ))}

                {restantes > 0 && (
                  <li>
                    <Link
                      href={bloque.hrefTodos}
                      className="block px-2 py-1 text-xs font-medium text-primary hover:underline"
                    >
                      Ver {restantes} más →
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
