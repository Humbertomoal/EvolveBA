"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El correo de invitación a una licitación, de principio a fin: prepara los
// adjuntos, arma las variables, muestra el ModalCorreo y — si el lote sale
// completo — aplica el lanzamiento.
//
// ── Por qué este componente existe ──────────────────────────────────────────
// Este bloque estaba COPIADO en dos sitios (LicitacionForm, DetalleLicitacion)
// y la pantalla de lanzamiento iba a ser el tercero. Cada copia repetía las
// mismas ~55 líneas de <ModalCorreo tipo="INVITACION_LICITACION"> más su
// propia versión de `variablesInvitacionPorDestinatario`. Y las copias ya
// habían divergido: la de DetalleLicitacion cerraba el modal en `onEnviado`
// sin sellar `invitacionesEnviadasEn`, así que un reenvío desde el detalle no
// dejaba rastro. Ese es exactamente el modo de fallo de tener tres copias: se
// arregla una y las otras se quedan atrás.
//
// Lo que aquí se escribe UNA vez y antes vivía suelto en cada copia:
//   · el sello del envío vía `lanzarLicitacionAction`
//   · el ref que distingue "cancelé" de "se envió" (ver `envioOkRef`)
//   · el rescate del caso F (correos fuera + sello fallido)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { IconAlertTriangle } from "@tabler/icons-react";
import ModalCorreo from "@/src/components/ModalCorreo";
import { prepararAdjuntosInvitacionAction } from "@/src/lib/adjuntosCorreoActions";
import { lanzarLicitacionAction } from "@/src/lib/licitacionesActions";
import {
  generarEnlacesFichas,
  generarTablaMateriales,
} from "@/src/lib/plantillasCorreo";
import { getConfigEmpresa } from "@/src/config/empresa";
import { formatFechaMexico } from "@/src/lib/dateUtils";
import type { AdjuntoCorreo } from "@/src/lib/emailService";
import type { DatosInvitacionLicitacion } from "@/src/lib/datosInvitacionTypes";

/** Variables {tablaMateriales, cantidadMateriales, enlacesFichas} por destinatario. */
function variablesInvitacionPorDestinatario(
  datos: DatosInvitacionLicitacion,
  enlacesPorDestinatario: Record<string, string[]>
): Record<string, Record<string, string>> {
  const mapa: Record<string, Record<string, string>> = {};
  for (const correo of datos.destinatarios) {
    const itemsProveedor = datos.itemsPorProveedor[correo] ?? datos.items;
    mapa[correo] = {
      tablaMateriales: generarTablaMateriales(itemsProveedor),
      cantidadMateriales: String(itemsProveedor.length),
      // Fichas que no cupieron como adjunto para ESTE proveedor; vacío si
      // todas se adjuntaron → la línea de la plantilla se colapsa.
      enlacesFichas: generarEnlacesFichas(enlacesPorDestinatario[correo] ?? []),
    };
  }
  return mapa;
}

/**
 * Fecha para el CUERPO del correo. Va por `formatFechaMexico`, que fija
 * `timeZone: "America/Mexico_City"`: sin eso la hora se renderizaría en la
 * zona del navegador del comprador y el proveedor recibiría una hora de
 * inicio que no es la de la licitación.
 */
function fmtFechaHoraCorreo(iso: string | null): string {
  if (!iso) return "";
  return formatFechaMexico(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Adjuntos = {
  adjuntos: AdjuntoCorreo[];
  adjuntosPorDestinatario: Record<string, AdjuntoCorreo[]>;
  enlacesPorDestinatario: Record<string, string[]>;
  omitidoPorTamano: boolean;
};

export default function ModalInvitacionLicitacion({
  licitacionId,
  numero,
  basePath,
  codigoCliente,
  datos,
  onCerrar,
  onLanzado,
}: {
  licitacionId: string;
  numero: string;
  basePath: string;
  codigoCliente: string;
  datos: DatosInvitacionLicitacion;
  /** Se cierra el modal sin enviar nada (la X, Cancelar) o ya se terminó. */
  onCerrar: () => void;
  /** El lote salió completo y el lanzamiento quedó aplicado. */
  onLanzado?: () => void;
}) {
  const router = useRouter();
  const [adjuntos, setAdjuntos] = useState<Adjuntos | null>(null);
  // Caso F: los correos SALIERON pero el sello/lanzamiento falló. No se puede
  // tragar en silencio — quedarían proveedores invitados sin que la licitación
  // lo registre. Se ofrece reintentar SOLO el lanzamiento; los correos no se
  // reenvían, y el servidor es idempotente (compare-and-set en la promoción,
  // `invitacionesEnviadasEn: null` en el sello).
  const [lanzamientoFallido, setLanzamientoFallido] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);

  // ModalCorreo llama `onCerrar()` TAMBIÉN después de un envío exitoso
  // (handleEnviar hace `onEnviado?.(); onCerrar();`), así que onCerrar por sí
  // solo no distingue "cancelé" de "se envió". Esta bandera sí. Es un ref y no
  // un state porque onEnviado no se espera: se lee en el mismo tick.
  const envioOkRef = useRef(false);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const {
          adjuntosComunes,
          adjuntosPorDestinatario,
          enlacesPorDestinatario,
          documentosOmitidos,
        } = await prepararAdjuntosInvitacionAction({
          documentosLicitacion: datos.archivosAdjuntos,
          fichasPorDestinatario: datos.fichasPorDestinatario,
        });
        if (!vigente) return;
        setAdjuntos({
          adjuntos: adjuntosComunes,
          adjuntosPorDestinatario,
          enlacesPorDestinatario,
          omitidoPorTamano: documentosOmitidos.length > 0,
        });
      } catch {
        if (!vigente) return;
        toast.error("No se pudieron preparar los adjuntos del correo.");
        onCerrar();
      }
    })();
    return () => {
      vigente = false;
    };
    // Solo al montar: el payload no cambia mientras el modal está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Segunda mitad de la operación: los correos YA SALIERON, ahora se aplica el
   * lanzamiento. Idempotente por construcción, así que sirve igual para el
   * primer envío que para un reenvío y para el botón de reintentar:
   *   · el CAS exige `estado: "Borrador"` → una Programada o En Proceso NO se
   *     re-promueve, solo se sella.
   *   · el sello exige `invitacionesEnviadasEn: null` → un reenvío CONSERVA la
   *     fecha del envío original en vez de pisarla.
   */
  async function aplicarLanzamiento() {
    setLanzamientoFallido(null);
    setReintentando(true);
    try {
      const resultado = await lanzarLicitacionAction(licitacionId, basePath);
      if (!resultado.ok) {
        setReintentando(false);
        setLanzamientoFallido(resultado.error);
        toast.error("Correos enviados, pero el registro quedó pendiente.");
        return;
      }
      toast.success(
        resultado.promovida
          ? "Licitación lanzada y proveedores notificados."
          : "Invitaciones enviadas a los proveedores."
      );
      // Para que la fila/pantalla muestre "Enviadas el …" sin recargar a mano.
      router.refresh();
      onLanzado?.();
      onCerrar();
    } catch (err) {
      setReintentando(false);
      const msg = err instanceof Error ? err.message : String(err);
      setLanzamientoFallido(
        `Los correos de invitación SÍ se enviaron, pero no se pudo registrar el envío: ${msg}`
      );
      toast.error("Correos enviados, pero el registro quedó pendiente.");
    }
  }

  // ── Caso F: los correos ya salieron, solo falta registrarlo ────────────────
  if (lanzamientoFallido) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-start gap-3 px-5 py-5">
            <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Registro pendiente — los correos ya se enviaron
              </p>
              <p className="mt-1 text-xs text-amber-800">{lanzamientoFallido}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Reintentar no vuelve a enviar los correos.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={reintentando}
              onClick={aplicarLanzamiento}
              className="rounded-md bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-secundario)] disabled:opacity-60"
            >
              {reintentando ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!adjuntos) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="rounded-lg bg-white px-6 py-5 text-sm text-zinc-600 shadow-xl">
          Preparando adjuntos del correo…
        </div>
      </div>
    );
  }

  // Destinatario de referencia para la VISTA PREVIA. Al enviar, cada quien
  // recibe lo suyo vía `variablesPorDestinatario`.
  const referencia = datos.destinatarios[0];
  const itemsReferencia = datos.itemsPorProveedor[referencia] ?? datos.items;

  return (
    <ModalCorreo
      abierto
      onCerrar={() => {
        // Tras un envío exitoso ModalCorreo llama onEnviado y LUEGO onCerrar.
        // El cierre de ese caso ya lo maneja `aplicarLanzamiento`; aquí solo
        // se atiende la cancelación real (la X o el botón Cancelar), que no
        // envía correos y por tanto no cambia NADA en la licitación.
        if (envioOkRef.current) {
          envioOkRef.current = false;
          return;
        }
        onCerrar();
      }}
      onEnviado={() => {
        // ModalCorreo llama onEnviado SOLO si NINGÚN destinatario falló (ver
        // handleEnviar: con un solo error sale por la rama de error). Por eso
        // registrar aquí significa "el lote completo salió"; un envío parcial
        // no llega nunca a esta línea y se comporta como cancelar.
        //
        // La bandera se marca ANTES de cualquier await: onEnviado no se espera
        // y onCerrar corre en el mismo tick, justo después.
        envioOkRef.current = true;
        void aplicarLanzamiento();
      }}
      tipo="INVITACION_LICITACION"
      codigoCliente={codigoCliente}
      variables={{
        numeroLicitacion: numero,
        fechaInicio: fmtFechaHoraCorreo(datos.fechaInicio),
        fechaFin: fmtFechaHoraCorreo(datos.fechaFin),
        cantidadMateriales: String(itemsReferencia.length),
        tablaMateriales: generarTablaMateriales(itemsReferencia),
        enlacesFichas: generarEnlacesFichas(
          adjuntos.enlacesPorDestinatario[referencia] ?? []
        ),
        instruccionesLicitacion:
          datos.instrucciones +
          (adjuntos.omitidoPorTamano
            ? "\n\nLos archivos adjuntos están disponibles en el portal."
            : ""),
        nombreComprador: datos.nombreComprador,
        correoComprador: datos.correoComprador,
        telefonoComprador: getConfigEmpresa(codigoCliente).telefonoContacto,
      }}
      destinatarios={datos.destinatarios}
      adjuntos={adjuntos.adjuntos}
      adjuntosPorDestinatario={adjuntos.adjuntosPorDestinatario}
      aviso={
        datos.excluidos > 0
          ? `${datos.excluidos} proveedor${datos.excluidos === 1 ? "" : "es"} sin correo de contacto ${datos.excluidos === 1 ? "fue excluido" : "fueron excluidos"} del envío.`
          : undefined
      }
      variablesPorDestinatario={variablesInvitacionPorDestinatario(
        datos,
        adjuntos.enlacesPorDestinatario
      )}
      notaPersonalizacion={
        referencia
          ? `Vista previa para ${
              datos.nombrePorDestinatario[referencia] ?? "el proveedor"
            }. La lista de materiales se personaliza automáticamente para cada proveedor según su catálogo.`
          : undefined
      }
    />
  );
}
