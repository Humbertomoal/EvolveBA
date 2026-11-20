import { formatFechaDia } from "@/src/lib/dateUtils";
import { IconInfoCircle, IconPaperclip } from "@tabler/icons-react";
import { Fragment } from "react";
import FilaEncabezadoGrupo from "@/src/components/FilaEncabezadoGrupo";
import {
  agruparPartidas,
  encabezadosPorIndice,
  type GrupoLectura,
} from "@/src/lib/agruparPartidas";

export type MaterialResumen = {
  /**
   * Grupo (sitio de entrega) del material. Ausente o null = sin grupo. Los
   * materiales deben llegar en ORDEN_PARTIDAS (cada grupo contiguo). Si
   * ninguno tiene grupo, la tabla se ve exactamente como antes, sin encabezados.
   */
  grupo?: GrupoLectura | null;
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
  // Encabezado de grupo antes de la fila donde empieza cada sección. Vacío si
  // ningún material tiene grupo.
  const encabezadoEn = encabezadosPorIndice(agruparPartidas(materiales, (m) => m.grupo));
  const columnas = mostrarEspecificaciones ? 6 : 5;
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
              {materiales.map((m, indice) => (
                <Fragment key={m.id}>
                {encabezadoEn.has(indice) && (
                  <FilaEncabezadoGrupo grupo={encabezadoEn.get(indice)!.grupo} colSpan={columnas} />
                )}
                <tr>
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
                    {formatFechaDia(m.fechaEntrega)}
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
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
