"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/src/lib/prisma";
import { getClienteByCodigo } from "@/src/lib/getClienteByCodigo";
import { calcularAnalisisPorItem, calcularResumenAhorro } from "@/src/lib/licitacionesAhorro";
import OrdenCompraPDF, { type OrdenCompraPdfData } from "@/src/components/pdf/OrdenCompraPDF";
import ResumenLicitacionPDF, {
  type ResumenLicitacionPdfData,
} from "@/src/components/pdf/ResumenLicitacionPDF";
import ComparativoOfertasPDF, {
  type ComparativoOfertasPdfData,
} from "@/src/components/pdf/ComparativoOfertasPDF";
import { sanitizarNombreArchivo } from "@/src/components/pdf/pdfHelpers";

export type PdfResult = { base64: string; filename: string };

function clienteDesdeBasePath(basePath: string) {
  const codigo = basePath.replace(/^\//, "");
  return getClienteByCodigo(codigo || null);
}

// ── Orden de Compra ──────────────────────────────────────────────────────────

export async function descargarOrdenCompraPdfAction(
  ordenId: string,
  basePath: string
): Promise<PdfResult> {
  const cliente = clienteDesdeBasePath(basePath);
  if (!cliente) throw new Error("No se encontró la configuración del cliente.");

  const orden = await prisma.ordenCompra.findUnique({
    where: { id: ordenId },
    include: {
      licitacion: { select: { numero: true, instrucciones: true } },
      proveedor: {
        select: {
          razonSocial: true,
          rfc: true,
          domicilio: true,
          vendedorNombre: true,
          vendedorCorreo: true,
        },
      },
      lineas: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!orden) throw new Error("No se encontró la orden de compra.");

  const datos: OrdenCompraPdfData = {
    numero: orden.numero,
    fechaCreacion: orden.fechaCreacion,
    estado: orden.estado,
    licitacionNumero: orden.licitacion?.numero ?? null,
    instrucciones: orden.licitacion?.instrucciones ?? null,
    proveedor: {
      razonSocial: orden.proveedor.razonSocial,
      rfc: orden.proveedor.rfc,
      domicilio: orden.proveedor.domicilio,
      vendedorNombre: orden.proveedor.vendedorNombre,
      vendedorCorreo: orden.proveedor.vendedorCorreo,
    },
    lineas: orden.lineas.map((l) => ({
      id: l.id,
      productoNombre: l.productoNombre,
      cantidad: l.cantidad,
      unidadMedida: l.unidadMedida,
      precioUnitario: l.precioUnitario,
      moneda: l.moneda,
      fechaEntregaObjetivo: l.fechaEntregaObjetivo,
      subtotal: l.subtotal,
    })),
  };

  const buffer = await renderToBuffer(<OrdenCompraPDF cliente={cliente} orden={datos} />);
  const filename = `${sanitizarNombreArchivo(orden.numero)}_${sanitizarNombreArchivo(
    orden.proveedor.razonSocial
  )}.pdf`;

  return { base64: buffer.toString("base64"), filename };
}

// ── Datos compartidos: licitación + ofertas + análisis de ahorro ────────────

async function cargarLicitacionParaPdf(licitacionId: string) {
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: licitacionId },
    include: {
      items: {
        include: { producto: { select: { nombre: true, unidadMedida: true } } },
        orderBy: { createdAt: "asc" },
      },
      proveedoresInvitados: {
        include: { proveedor: { select: { id: true, razonSocial: true } } },
        orderBy: { invitadoEn: "asc" },
      },
    },
  });
  if (!licitacion) throw new Error("No se encontró la licitación.");

  const ofertas = await prisma.ofertaItem.findMany({
    where: { licitacionItem: { licitacionId } },
    include: { proveedor: { select: { id: true, razonSocial: true } } },
    orderBy: [{ ronda: "asc" }, { precioUnitario: "asc" }],
  });

  const monedaCounts = new Map<string, number>();
  for (const item of licitacion.items) {
    monedaCounts.set(item.moneda, (monedaCounts.get(item.moneda) ?? 0) + 1);
  }
  const monedaPredominante =
    [...monedaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MXN";

  const analisis = calcularAnalisisPorItem(licitacion.items, ofertas);
  const resumenAhorro = calcularResumenAhorro(analisis, ofertas.length > 0);

  return { licitacion, ofertas, monedaPredominante, analisis, resumenAhorro };
}

function nombreArchivoLicitacion(numero: string): string {
  return numero.trim().startsWith("Licitacion")
    ? sanitizarNombreArchivo(numero)
    : `Licitacion-${sanitizarNombreArchivo(numero)}`;
}

// ── Resumen de Licitación ────────────────────────────────────────────────────

export async function descargarResumenLicitacionPdfAction(
  licitacionId: string,
  basePath: string
): Promise<PdfResult> {
  const cliente = clienteDesdeBasePath(basePath);
  if (!cliente) throw new Error("No se encontró la configuración del cliente.");

  const { licitacion, ofertas, monedaPredominante, analisis } =
    await cargarLicitacionParaPdf(licitacionId);

  let resultado: ResumenLicitacionPdfData["resultado"] = null;
  if (licitacion.estado === "Finalizada") {
    const asignaciones = await prisma.asignacionMaterial.findMany({
      where: { licitacionId },
      include: { proveedor: { select: { razonSocial: true } } },
      orderBy: { orden: "asc" },
    });
    const asignacionesPorItem = new Map<string, typeof asignaciones>();
    for (const a of asignaciones) {
      const lista = asignacionesPorItem.get(a.licitacionItemId) ?? [];
      lista.push(a);
      asignacionesPorItem.set(a.licitacionItemId, lista);
    }

    resultado = {
      porMaterial: licitacion.items.map((item, i) => {
        const ganadoras = asignacionesPorItem.get(item.id) ?? [];
        const ganadorNombre =
          ganadoras.length > 0
            ? [...new Set(ganadoras.map((a) => a.proveedor.razonSocial))].join(", ")
            : null;
        return {
          id: item.id,
          productoNombre: item.producto.nombre,
          ganadorNombre,
          precioFinal: ganadoras[0]?.precioUnitario ?? null,
          moneda: item.moneda,
          ahorro: analisis[i]?.ahorroTotal ?? null,
        };
      }),
    };
  }

  const datos: ResumenLicitacionPdfData = {
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia,
    tipoLicitacion: licitacion.tipoLicitacion,
    estado: licitacion.estado,
    modoLicitacion: licitacion.modoLicitacion,
    fechaEjecucion: licitacion.fechaEjecucion,
    fechaFinLicitacion: licitacion.fechaFinLicitacion,
    fechaInicioRangoEntrega: licitacion.fechaInicioRangoEntrega,
    fechaFinRangoEntrega: licitacion.fechaFinRangoEntrega,
    costoObjetivo: licitacion.costoObjetivo,
    monedaPredominante,
    instrucciones: licitacion.instrucciones,
    materiales: licitacion.items.map((item) => ({
      id: item.id,
      productoNombre: item.producto.nombre,
      cantidadSolicitada: item.cantidadSolicitada,
      unidadMedida: item.producto.unidadMedida,
      moneda: item.moneda,
      fechaEntrega: item.fechaEntrega,
    })),
    proveedores: licitacion.proveedoresInvitados.map((lp) => ({
      id: lp.proveedor.id,
      razonSocial: lp.proveedor.razonSocial,
    })),
    resultado,
  };

  const buffer = await renderToBuffer(
    <ResumenLicitacionPDF cliente={cliente} licitacion={datos} />
  );
  const filename = `${nombreArchivoLicitacion(licitacion.numero)}_Resumen.pdf`;

  return { base64: buffer.toString("base64"), filename };
}

// ── Comparativo de Ofertas ───────────────────────────────────────────────────

export async function descargarComparativoOfertasPdfAction(
  licitacionId: string,
  basePath: string
): Promise<PdfResult> {
  const cliente = clienteDesdeBasePath(basePath);
  if (!cliente) throw new Error("No se encontró la configuración del cliente.");

  const { licitacion, ofertas, monedaPredominante, analisis, resumenAhorro } =
    await cargarLicitacionParaPdf(licitacionId);

  // Proveedor con el mejor precio actual por material (para "Proveedor ganador").
  const proveedorGanadorPorItem = new Map<string, string>();
  for (const item of licitacion.items) {
    const itemOfertas = ofertas.filter((o) => o.licitacionItemId === item.id);
    if (itemOfertas.length === 0) continue;
    const mejor = itemOfertas.reduce((min, o) =>
      o.precioUnitario < min.precioUnitario ? o : min
    );
    proveedorGanadorPorItem.set(item.id, mejor.proveedor.razonSocial);
  }

  const materiales: ComparativoOfertasPdfData["materiales"] = licitacion.items.map(
    (item, i) => ({
      id: item.id,
      productoNombre: item.producto.nombre,
      moneda: item.moneda,
      objetivoUnitario: analisis[i]?.objetivoUnitario ?? null,
      primeraRondaUnitario: analisis[i]?.primeraRondaUnitario ?? null,
      mejorActualUnitario: analisis[i]?.mejorActualUnitario ?? null,
      variacionPct: analisis[i]?.variacionPct ?? null,
      ahorroTotal: analisis[i]?.ahorroTotal ?? null,
      proveedorGanador: proveedorGanadorPorItem.get(item.id) ?? null,
    })
  );

  // Historial de pujas por ronda y proveedor.
  const provMap = new Map<string, string>();
  for (const o of ofertas) provMap.set(o.proveedorId, o.proveedor.razonSocial);
  const proveedoresHistorial = [...provMap.entries()].map(([id, nombre]) => ({ id, nombre }));

  const materialesHistorial = licitacion.items
    .filter((item) => ofertas.some((o) => o.licitacionItemId === item.id))
    .map((item) => {
      const itemOfertas = ofertas.filter((o) => o.licitacionItemId === item.id);
      const rondas = [...new Set(itemOfertas.map((o) => o.ronda))].sort((a, b) => a - b);
      const filas = rondas.map((ronda) => {
        const precios: Record<string, number | null> = {};
        for (const prov of proveedoresHistorial) {
          const oferta = itemOfertas.find(
            (o) => o.ronda === ronda && o.proveedorId === prov.id
          );
          precios[prov.id] = oferta?.precioUnitario ?? null;
        }
        return { ronda, precios };
      });
      return {
        id: item.id,
        productoNombre: item.producto.nombre,
        moneda: item.moneda,
        filas,
      };
    });

  const datos: ComparativoOfertasPdfData = {
    numero: licitacion.numero,
    jerarquia: licitacion.jerarquia,
    fechaEjecucion: licitacion.fechaEjecucion,
    fechaFinLicitacion: licitacion.fechaFinLicitacion,
    monedaPredominante,
    indicadores: {
      presupuestoObjetivoTotal: resumenAhorro.presupuestoObjetivoTotal,
      primeraRondaTotal: resumenAhorro.primeraRondaTotal,
      mejorPrecioActualTotal: resumenAhorro.mejorPrecioActualTotal,
      adherenciaPct: resumenAhorro.adherenciaPct,
      ahorroTotal: resumenAhorro.ahorroTotal,
      ahorroPct: resumenAhorro.ahorroPct,
    },
    materiales,
    historial:
      materialesHistorial.length > 0
        ? { proveedores: proveedoresHistorial, materiales: materialesHistorial }
        : null,
  };

  const buffer = await renderToBuffer(
    <ComparativoOfertasPDF cliente={cliente} licitacion={datos} />
  );
  const filename = `${nombreArchivoLicitacion(licitacion.numero)}_Comparativo.pdf`;

  return { base64: buffer.toString("base64"), filename };
}
