import { IconMapPin } from "@tabler/icons-react";
import {
  domicilioDeGrupo,
  ETIQUETA_SIN_GRUPO,
  type GrupoLectura,
} from "@/src/lib/agruparPartidas";

/**
 * Fila de encabezado de un grupo de partidas dentro de una tabla de lectura
 * (portal del proveedor, comparativo). Sin "use client": no tiene estado, así
 * que sirve igual desde un Server o un Client Component.
 *
 * `grupo = null` es la sección "Sin grupo". Quien la usa solo la pinta cuando
 * la licitación tiene grupos (ver `agruparPartidas`).
 */
export default function FilaEncabezadoGrupo({
  grupo,
  colSpan,
  textoSinGrupo = "sin domicilio de entrega",
}: {
  grupo: GrupoLectura | null;
  colSpan: number;
  /** Aclaración junto a "Sin grupo". */
  textoSinGrupo?: string;
}) {
  const domicilio = domicilioDeGrupo(grupo);
  return (
    <tr className="border-t-2 border-zinc-200 bg-zinc-50">
      <td colSpan={colSpan} className="px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-zinc-800">
            {grupo ? grupo.nombre : ETIQUETA_SIN_GRUPO}
          </span>
          {grupo && domicilio && (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <IconMapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {domicilio}
            </span>
          )}
          {!grupo && <span className="text-zinc-500">· {textoSinGrupo}</span>}
        </div>
      </td>
    </tr>
  );
}
