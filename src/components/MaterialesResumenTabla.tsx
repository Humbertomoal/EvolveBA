import { IconInfoCircle, IconPaperclip } from "@tabler/icons-react";

export type MaterialResumen = {
  id: string;
  nombre: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  fechaEntrega: string | null;
  moneda: string;
  especificacionesTecnicas?: string | null;
  archivosEspecificaciones?: string[];
};

function nombreDesdeUrl(url: string): string {
  try {
    const archivo = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
    return archivo.replace(/^\d+-/, "") || archivo;
  } catch {
    return url;
  }
}

function formatFechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Tabla compacta y de solo lectura con los materiales de una licitación. */
export default function MaterialesResumenTabla({
  materiales,
  titulo = "Materiales de esta licitación",
  mensajeVacio = "Agrega materiales en el paso anterior para verlos aquí",
  mostrarEspecificaciones = false,
}: {
  materiales: MaterialResumen[];
  titulo?: string;
  mensajeVacio?: string;
  mostrarEspecificaciones?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-zinc-700">{titulo}</p>
      {materiales.length === 0 ? (
        <p className="text-xs text-zinc-400">{mensajeVacio}</p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border bg-surface-muted text-left text-xs font-medium text-zinc-500">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Unidad</th>
                <th className="px-3 py-2 font-medium">Fecha requerida</th>
                <th className="px-3 py-2 font-medium">Moneda</th>
                {mostrarEspecificaciones && (
                  <th className="px-3 py-2 font-medium">Especificaciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td
                    className="max-w-48 truncate px-3 py-2 text-zinc-800"
                    title={m.nombre}
                  >
                    {m.nombre}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600">
                    {m.cantidadSolicitada}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{m.unidadMedida}</td>
                  <td className="px-3 py-2 text-zinc-500">
                    {formatFechaCorta(m.fechaEntrega)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{m.moneda}</td>
                  {mostrarEspecificaciones && (
                    <td className="px-3 py-2">
                      {m.especificacionesTecnicas || (m.archivosEspecificaciones && m.archivosEspecificaciones.length > 0) ? (
                        <div className="flex items-center gap-1.5">
                          {m.especificacionesTecnicas && (
                            <span
                              title={m.especificacionesTecnicas}
                              className="text-zinc-400"
                            >
                              <IconInfoCircle className="h-4 w-4" />
                            </span>
                          )}
                          {m.archivosEspecificaciones?.map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={nombreDesdeUrl(url)}
                              className="text-zinc-400 hover:text-[var(--color-primario)]"
                            >
                              <IconPaperclip className="h-4 w-4" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
