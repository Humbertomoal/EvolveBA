"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { crearOrdenesCompraParaLicitacion } from "./ordenesUtils";
import { exigirProveedorSesion } from "./proveedorSessionSegura";
import { getDestinatariosLicitacion } from "./destinatariosComprador";
import { convertirTextoAHtml, enviarCorreo } from "./emailService";
import { renderizarPlantilla } from "./plantillasCorreo";
import { convertirAMoneda, parseTiposCambio } from "./conversionMoneda";
import { formatImporte } from "./monedas";
import { formatFechaMexico } from "./dateUtils";
import { getConfigEmpresa } from "@/src/config/empresa";
import {
  construirResumenRespuesta,
  ESTATUS_PENDIENTE,
  type MaterialRespondido,
} from "./resumenRespuestaProveedor";

export type ResultadoRespuestaFinal =
  | { ok: true; correosEnviados: number }
  | { ok: false; motivo: "faltan_respuestas" | "sin_asignaciones"; mensaje: string };

export async function confirmarAsignacionProveedorAction(
  asignacionId: string,
  licitacionId: string,
  basePath: string
) {
  const updated = await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      estatusProveedor: "Confirmado",
      fechaConfirmacion: new Date(),
    },
    select: { proveedorId: true },
  });

  // Create OC if one doesn't exist yet for this proveedor+licitacion
  await crearOrdenesCompraParaLicitacion(licitacionId, updated.proveedorId);

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}/resultado`);
  revalidatePath(`${basePath}/proveedor/licitaciones`);
  revalidatePath(`${basePath}/proveedor/ordenes`);
}

export async function rechazarAsignacionProveedorAction(
  asignacionId: string,
  motivo: string,
  licitacionId: string,
  basePath: string
) {
  await prisma.asignacionMaterial.update({
    where: { id: asignacionId },
    data: {
      estatusProveedor: "Rechazado",
      motivoRechazo: motivo,
      // Constancia del momento del rechazo. Antes solo quedaba `updatedAt`,
      // que cualquier escritura posterior pisa, así que no era reconstruible.
      fechaRechazo: new Date(),
    },
  });
  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}/resultado`);
  revalidatePath(`${basePath}/proveedor/licitaciones`);
}

/**
 * El proveedor da por cerrada su respuesta a la asignación: se manda UN correo
 * resumen al comprador dueño y al Gerente de Compras.
 *
 * Es REVERSIBLE: si después corrige un material, puede volver a confirmar y se
 * envía un resumen actualizado.
 *
 * ── Identidad ──────────────────────────────────────────────────────────────
 * El proveedorId sale de la sesión, nunca del cliente: si no, cualquiera podría
 * cerrar la respuesta de un competidor.
 *
 * ── Por qué se re-verifica en el servidor ──────────────────────────────────
 * El botón se deshabilita en el UI cuando quedan materiales Pendientes, pero
 * esta acción es invocable directamente. Sin recontar contra la BD se podría
 * "confirmar a medias" y disparar un resumen incompleto al comprador.
 *
 * ── El correo NUNCA tumba la confirmación ─────────────────────────────────
 * Va en try/catch, igual que registrarCambioEstado: si Graph falla, el
 * proveedor ya respondió y su pantalla no se rompe. Se devuelve ok con
 * correosEnviados = 0 para que el UI pueda matizar el mensaje.
 */
export async function confirmarRespuestaFinalAction(
  licitacionId: string,
  basePath: string,
  codigoCliente: string
): Promise<ResultadoRespuestaFinal> {
  const { proveedorId, razonSocial } = await exigirProveedorSesion();

  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    select: { numero: true, tiposCambio: true, monedaConsolidacion: true },
  });

  const asignaciones = await prisma.asignacionMaterial.findMany({
    where: { licitacionId, proveedorId },
    select: {
      cantidadAsignada: true,
      precioUnitario: true,
      moneda: true,
      estatusProveedor: true,
      motivoRechazo: true,
      fechaRechazo: true,
      licitacionItem: {
        select: { producto: { select: { nombre: true, unidadMedida: true } } },
      },
    },
  });

  if (asignaciones.length === 0) {
    return {
      ok: false,
      motivo: "sin_asignaciones",
      mensaje: "No tienes materiales asignados en esta licitación.",
    };
  }

  const pendientes = asignaciones.filter(
    (a) => a.estatusProveedor === ESTATUS_PENDIENTE
  ).length;
  if (pendientes > 0) {
    return {
      ok: false,
      motivo: "faltan_respuestas",
      mensaje: `Aún tienes ${pendientes} material${pendientes === 1 ? "" : "es"} sin responder. Acepta o rechaza todos antes de confirmar.`,
    };
  }

  // ── Correo resumen — best-effort ──────────────────────────────────────────
  let correosEnviados = 0;
  try {
    const tiposCambio = parseTiposCambio(licitacion?.tiposCambio);
    const monedaConsol = licitacion?.monedaConsolidacion || "MXN";

    const materiales: MaterialRespondido[] = asignaciones.map((a) => ({
      productoNombre: a.licitacionItem.producto.nombre,
      unidadMedida: a.licitacionItem.producto.unidadMedida,
      cantidadAsignada: a.cantidadAsignada,
      estatusProveedor: a.estatusProveedor,
      motivoRechazo: a.motivoRechazo,
      fechaRechazoFormateada: a.fechaRechazo
        ? formatFechaMexico(a.fechaRechazo, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      importeFormateado: formatImporte(
        convertirAMoneda(
          a.precioUnitario * a.cantidadAsignada,
          a.moneda,
          monedaConsol,
          tiposCambio
        ),
        monedaConsol
      ),
    }));

    const resumen = construirResumenRespuesta(materiales);
    const destinatarios = await getDestinatariosLicitacion(licitacionId);

    if (destinatarios.correos.length > 0) {
      const empresa = getConfigEmpresa(codigoCliente);
      const { asunto, cuerpo } = renderizarPlantilla(
        "RESPUESTA_PROVEEDOR",
        {
          nombreComprador: destinatarios.nombreComprador || "equipo de Compras",
          nombreProveedor: razonSocial,
          numeroLicitacion: licitacion?.numero ?? "",
          tablaAceptados: resumen.tablaAceptados,
          tablaRechazados: resumen.tablaRechazados,
          totalAceptados: String(resumen.totalAceptados),
          totalRechazados: String(resumen.totalRechazados),
          enlaceSeguimiento: `${empresa.urlPortal.replace(/\/portal$/, "")}${basePath}/comprador/seleccion-proveedores/${licitacionId}`,
        },
        codigoCliente
      );
      const cuerpoHtml = convertirTextoAHtml(cuerpo, codigoCliente);

      // enviarCorreo acepta UN destinatario; se envía uno por persona para que
      // el fallo de un buzón no cancele el resto.
      for (const para of destinatarios.correos) {
        const r = await enviarCorreo({ para, asunto, cuerpoHtml });
        if (r.exito) correosEnviados++;
        else console.error("[respuestaFinal] no se pudo enviar a", para, r.error);
      }
    } else {
      console.error(
        "[respuestaFinal] sin destinatarios: revisa Licitacion.compradorId y que exista alguien con rol Gerente de Compras",
        { licitacionId }
      );
    }
  } catch (error) {
    // El aviso es informativo; la respuesta del proveedor ya quedó guardada.
    console.error("[respuestaFinal] fallo al preparar/enviar el aviso", error);
  }

  revalidatePath(`${basePath}/proveedor/licitaciones/${licitacionId}/resultado`);
  return { ok: true, correosEnviados };
}
