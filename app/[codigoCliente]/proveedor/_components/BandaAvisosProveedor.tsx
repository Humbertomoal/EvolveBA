"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconBell, IconX } from "@tabler/icons-react";
import { getAvisosRondaPendientes } from "@/src/lib/chatActions";
import {
  esAvisoDeCierre,
  type AvisoLicitacionPendiente,
} from "@/src/lib/avisosProveedorTypes";

/**
 * Banda de novedades del portal del proveedor.
 *
 * Cubre el hueco del modal de LicitacionCotizacion: ese solo avisa a quien está
 * DENTRO de la licitación. Esta banda vive en el layout, así que sigue al
 * proveedor por todo el portal — la lista, el catálogo, sus órdenes.
 *
 * Se apoya en los avisos de chat sin leer (emisor "sistema") y no en un
 * "última ronda vista" local: el estado no-leído vive en la base, así que
 * sobrevive a cerrar sesión, cambiar de equipo y a los cambios de ronda
 * ocurridos mientras el proveedor no estaba conectado — que es justo el caso
 * que esta banda existe para cubrir.
 *
 * Presentación pura: todo el trabajo de datos está en chatActions.
 */
export default function BandaAvisosProveedor({
  basePath,
  proveedorId,
  avisosIniciales,
}: {
  basePath: string;
  proveedorId: string;
  avisosIniciales: AvisoLicitacionPendiente[];
}) {
  const [avisos, setAvisos] = useState(avisosIniciales);
  const [oculta, setOculta] = useState(false);

  // Mismo intervalo que ProveedorSidebarWrapper (30 s): un solo ritmo de
  // sondeo en el portal en vez de dos cadencias compitiendo.
  useEffect(() => {
    if (!proveedorId) return;
    const consultar = async () => {
      const pendientes = await getAvisosRondaPendientes(proveedorId);
      setAvisos(pendientes);
      // Si llega una novedad NUEVA se vuelve a mostrar aunque la hubieran
      // cerrado: descartar aplica al aviso que se vio, no a los futuros.
      setOculta((estabaOculta) => (pendientes.length === 0 ? false : estabaOculta));
    };
    const id = setInterval(consultar, 30_000);
    return () => clearInterval(id);
  }, [proveedorId]);

  // Al quedarse sin avisos (p. ej. entró a la licitación y se marcó leído) la
  // banda se retira sola y queda lista para reaparecer.
  useEffect(() => {
    if (avisos.length === 0 && oculta) setOculta(false);
  }, [avisos.length, oculta]);

  if (oculta || avisos.length === 0) return null;

  const varias = avisos.length > 1;
  const primero = avisos[0];

  const href = varias
    ? `${basePath}/proveedor/licitaciones`
    : `${basePath}/proveedor/licitaciones/${primero.licitacionId}`;

  let texto: string;
  if (varias) {
    texto = `Novedades en ${avisos.length} licitaciones`;
  } else if (esAvisoDeCierre(primero)) {
    texto = `La licitación ${primero.numero} finalizó sus rondas`;
  } else {
    texto = `Nueva ronda en la licitación ${primero.numero}: va en la ronda ${primero.rondaActual}`;
  }

  return (
    <div
      className="sticky top-16 z-20 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-6"
      role="status"
    >
      <IconBell className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="flex-1 text-sm text-amber-900">
        <span className="font-medium">{texto}</span>
        <Link
          href={href}
          className="ml-3 font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
        >
          {varias ? "Ver mis licitaciones" : "Entrar a la licitación"}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setOculta(true)}
        className="shrink-0 rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-900"
        aria-label="Ocultar aviso"
        title="Ocultar (reaparece al recargar si sigue pendiente)"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
