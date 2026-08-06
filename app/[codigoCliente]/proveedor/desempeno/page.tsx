import { notFound } from "next/navigation";
import { CODIGO_CLIENTE_SIN_ESPECIFICAR } from "@/src/lib/getClienteByCodigo";
import { PageTitle } from "@/app/_components/PageHeaderContext";
import { getProveedorSessionSegura } from "@/src/lib/proveedorSessionSegura";
import {
  calcularAnalisisPorItem,
  type LicitacionItemParaAhorro,
  type OfertaParaAhorro,
} from "@/src/lib/licitacionesAhorro";
import { convertirAMoneda, MONEDA_BASE, parseTiposCambio } from "@/src/lib/conversionMoneda";
import {
  claveMes,
  etiquetaMes,
  filtrosDesdeSearchParams,
  itemPasaFiltro,
  resolverRangoFechas,
} from "@/src/lib/tableroFiltros";
import {
  acumularPonderado,
  asignacionCuenta,
  construirPareto,
  fechaDeCompra,
  mesesEntre,
  promedioPonderado,
} from "@/src/lib/tableroHistorico";
import {
  agregarSobrecosto,
  type MaterialPerdido,
} from "@/src/lib/tableroProveedorSobrecosto";
import {
  getLicitacionesProveedor,
  getOpcionesProveedor,
  marcarProveedorAutenticado,
} from "@/src/lib/tableroProveedorQueries";
import DesempenoView from "./_components/DesempenoView";
import type { DesempenoData } from "./_components/types";

export default async function MiDesempenoPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigoCliente: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { codigoCliente } = await params;
  const sp = await searchParams;
  const basePath =
    codigoCliente === CODIGO_CLIENTE_SIN_ESPECIFICAR ? "" : `/${codigoCliente}`;

  // ── AISLAMIENTO ───────────────────────────────────────────────────────────
  // La identidad sale del JWT firmado, NO de la cookie cyrgo_proveedor_id (que
  // es escribible desde el navegador). Sin sesión válida → 404; nunca un
  // fallback a "el primer proveedor".
  const sesion = await getProveedorSessionSegura();
  if (!sesion) notFound();
  const proveedorId = marcarProveedorAutenticado(sesion.proveedorId);

  // El filtro de proveedor se FUERZA desde el servidor: si alguien mete
  // ?proveedor=<otro> en la URL, se sobrescribe aquí y nunca llega a la query.
  const filtros = { ...filtrosDesdeSearchParams(sp), proveedorId: sesion.proveedorId };
  const { startDate, endDate } = resolverRangoFechas(filtros);

  const [licitaciones, opciones] = await Promise.all([
    getLicitacionesProveedor(filtros, proveedorId),
    getOpcionesProveedor(filtros, proveedorId),
  ]);

  const etiquetaProducto = (p: { codigo: string; nombre: string }) =>
    `${p.codigo} — ${p.nombre}`;

  // ── Acumuladores ──────────────────────────────────────────────────────────
  let participadas = 0;
  let invitadas = 0;
  let ganadas = 0;
  let montoVenta = 0;
  let montoPrimeraRonda = 0;

  const cantidadProd = new Map<
    string,
    { etiqueta: string; unidad: string; cantidad: number }
  >();
  const montoProd = new Map<string, { etiqueta: string; valor: number }>();
  const ventaPorProducto = new Map<string, number>();
  const productosVendidos = new Map<
    string,
    { id: string; codigo: string; nombre: string; familia: string | null }
  >();
  const perdidos: MaterialPerdido[] = [];

  for (const lic of licitaciones) {
    const items = lic.items.filter((it) =>
      itemPasaFiltro(
        {
          productoId: it.productoId,
          familia: it.producto.familia,
          productoEliminado: it.producto.eliminado,
        },
        filtros
      )
    );
    if (items.length === 0) continue;

    const tc = parseTiposCambio(lic.tiposCambio);
    if (lic.proveedoresInvitados.length > 0) invitadas++;

    // `ofertas` ya viene filtrado a las de ESTE proveedor por el select.
    const ofertoAqui = items.some((it) => it.ofertas.length > 0);
    if (ofertoAqui) participadas++;

    // Asignaciones vivas del material (todas, para conocer al ganador).
    const asignacionesVivas = lic.asignaciones.filter((a) =>
      asignacionCuenta(a.estatusProveedor)
    );
    const misAsignaciones = asignacionesVivas.filter(
      (a) => a.proveedorId === sesion.proveedorId
    );
    if (misAsignaciones.length > 0) ganadas++;

    const itemPorId = new Map(items.map((it) => [it.id, it]));

    // ── Indicadores 4-7: ahorro en lo GANADO ────────────────────────────────
    // calcularAnalisisPorItem() alimentado SOLO con sus ofertas devuelve "su
    // primera ronda con puja": el mismo helper del comprador, leído desde el
    // otro lado del mostrador.
    const itemsAhorro: LicitacionItemParaAhorro[] = items.map((it) => ({
      id: it.id,
      cantidadSolicitada: it.cantidadSolicitada,
      precioObjetivo: null,
      moneda: it.moneda,
    }));
    const misOfertas: OfertaParaAhorro[] = items.flatMap((it) =>
      it.ofertas.map((o) => ({
        licitacionItemId: it.id,
        ronda: o.ronda,
        precioUnitario: o.precioUnitario,
      }))
    );
    const analisis = calcularAnalisisPorItem(itemsAhorro, misOfertas);
    const primeraRondaPorItem = new Map(
      analisis.map((a) => [a.licitacionItemId, a.primeraRondaUnitario])
    );

    for (const asig of misAsignaciones) {
      const it = itemPorId.get(asig.licitacionItemId);
      if (!it) continue;

      const montoMXN = convertirAMoneda(
        asig.precioUnitario * asig.cantidadAsignada,
        asig.moneda,
        MONEDA_BASE,
        tc
      );
      montoVenta += montoMXN;

      // Su propio precio de arranque sobre la MISMA cantidad adjudicada, para
      // que la resta (primera ronda − vendido) sea un ahorro limpio.
      const inicial = primeraRondaPorItem.get(asig.licitacionItemId);
      montoPrimeraRonda +=
        inicial != null
          ? convertirAMoneda(inicial * asig.cantidadAsignada, it.moneda, MONEDA_BASE, tc)
          : montoMXN;

      const etiqueta = etiquetaProducto(it.producto);
      const accCant = cantidadProd.get(it.productoId) ?? {
        etiqueta,
        unidad: it.producto.unidadMedida,
        cantidad: 0,
      };
      accCant.cantidad += asig.cantidadAsignada;
      cantidadProd.set(it.productoId, accCant);

      const accMonto = montoProd.get(it.productoId) ?? { etiqueta, valor: 0 };
      accMonto.valor += montoMXN;
      montoProd.set(it.productoId, accMonto);

      ventaPorProducto.set(
        it.productoId,
        (ventaPorProducto.get(it.productoId) ?? 0) + montoMXN
      );
      productosVendidos.set(it.productoId, {
        id: it.productoId,
        codigo: it.producto.codigo,
        nombre: it.producto.nombre,
        familia: it.producto.familia?.trim() ? it.producto.familia.trim() : null,
      });
    }

    // ── Indicadores 11-12: materiales que PERDIÓ ────────────────────────────
    for (const it of items) {
      if (it.ofertas.length === 0) continue; // no ofertó → no lo perdió
      const gano = misAsignaciones.some((a) => a.licitacionItemId === it.id);
      if (gano) continue;

      const delItem = asignacionesVivas.filter((a) => a.licitacionItemId === it.id);
      if (delItem.length === 0) continue; // sin ganador real → nada que comparar

      const miMejor = Math.min(...it.ofertas.map((o) => o.precioUnitario));
      // Cada lado se convierte con SU moneda antes de compararse.
      const precioOfertadoMXN = convertirAMoneda(miMejor, it.moneda, MONEDA_BASE, tc);
      const precioGanadorMXN = Math.min(
        ...delItem.map((a) => convertirAMoneda(a.precioUnitario, a.moneda, MONEDA_BASE, tc))
      );
      const cantidad = delItem.reduce((s, a) => s + a.cantidadAsignada, 0);

      perdidos.push({
        productoId: it.productoId,
        productoEtiqueta: etiquetaProducto(it.producto),
        precioOfertadoMXN,
        precioGanadorMXN,
        cantidad,
      });
    }
  }

  const sobrecosto = agregarSobrecosto(perdidos);

  // ── #8: variación de precio del producto elegido (o el más vendido) ───────
  const topVendido =
    [...ventaPorProducto.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const productoVariacion = filtros.productoId || filtros.prodVariacion || topVendido;

  const variacionMes = new Map<string, { montoMXN: number; cantidad: number }>();
  if (productoVariacion) {
    for (const lic of licitaciones) {
      const tc = parseTiposCambio(lic.tiposCambio);
      const fecha = fechaDeCompra(lic);
      const itemPorId = new Map(lic.items.map((it) => [it.id, it]));
      for (const asig of lic.asignaciones) {
        if (asig.proveedorId !== sesion.proveedorId) continue; // solo SUS ventas
        if (!asignacionCuenta(asig.estatusProveedor)) continue;
        const it = itemPorId.get(asig.licitacionItemId);
        if (!it || it.productoId !== productoVariacion) continue;

        const montoMXN = convertirAMoneda(
          asig.precioUnitario * asig.cantidadAsignada,
          asig.moneda,
          MONEDA_BASE,
          tc
        );
        const mes = claveMes(fecha);
        const acc = variacionMes.get(mes) ?? { montoMXN: 0, cantidad: 0 };
        acumularPonderado(acc, { montoMXN, cantidad: asig.cantidadAsignada });
        variacionMes.set(mes, acc);
      }
    }
  }

  const data: DesempenoData = {
    proveedorNombre: sesion.razonSocial,
    esImpersonacion: sesion.esImpersonacion,
    kpis: {
      participadas,
      invitadas,
      ganadas,
      tasaConversion:
        participadas > 0 ? Math.round((ganadas / participadas) * 1000) / 10 : null,
      montoVenta,
      montoPrimeraRonda,
      montoMejorPrecio: montoVenta, // mismo número por construcción — ver types.ts
      ahorroGenerado: montoPrimeraRonda - montoVenta,
    },
    variacionPrecio: mesesEntre({ desde: startDate, hasta: endDate }).map((mes) => {
      const acc = variacionMes.get(mes);
      return {
        mes,
        etiqueta: etiquetaMes(mes),
        precioPromedio: acc ? promedioPonderado([acc]) : null,
        cantidad: acc?.cantidad ?? 0,
      };
    }),
    productoVariacion,
    productosVendidos: [...productosVendidos.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-MX")
    ),
    cantidadPorProducto: [...cantidadProd.entries()]
      .map(([productoId, v]) => ({ productoId, ...v }))
      .filter((p) => p.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad),
    montoPorProducto: construirPareto(
      [...montoProd.entries()].map(([id, v]) => ({ id, ...v }))
    ),
    sobrecostoMonto: construirPareto(
      sobrecosto.porProducto.map((p) => ({
        id: p.productoId,
        etiqueta: p.etiqueta,
        valor: p.sobrecostoMXN,
      }))
    ),
    sobrecostoPct: sobrecosto.porProducto
      .map((p) => ({
        productoId: p.productoId,
        etiqueta: p.etiqueta,
        porcentaje: p.sobrecostoPct,
        materiales: p.materiales,
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje),
    sobrecostoResumen: {
      totalMXN: sobrecosto.sobrecostoTotalMXN,
      perdidosTotal: sobrecosto.perdidosTotal,
      perdidosMasBaratos: sobrecosto.perdidosMasBaratos,
    },
    familiasOpciones: opciones.familias,
    productosOpciones: opciones.productos,
    hayProductosSinFamilia: opciones.hayProductosSinFamilia,
    periodo: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
  };

  return (
    <div className="max-w-7xl space-y-6">
      <PageTitle title="Mi Desempeño" />
      <DesempenoView data={data} filtros={filtros} basePath={basePath} />
    </div>
  );
}
