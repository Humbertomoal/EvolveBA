import { CODIGO_CLIENTE_SIN_ESPECIFICAR, getClienteByCodigo } from "@/src/lib/getClienteByCodigo";
import { getConfigEmpresa } from "@/src/config/empresa";
import { prisma } from "@/src/lib/prisma";
import { notFound } from "next/navigation";
import {
  convertirAMoneda,
  formatMontoConEquivalencia,
  notaTipoCambio,
  parseTiposCambio,
} from "@/src/lib/conversionMoneda";
import { formatImporte } from "@/src/lib/monedas";
import PrintTrigger from "./_components/PrintTrigger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function formatFecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Sin formatMoneda local: cada importe se muestra en la moneda CONTRACTUAL de
// su línea (OrdenCompraLinea.moneda) con la equivalencia consolidada, vía
// formatMontoConEquivalencia. Es EL MISMO documento que imprime el proveedor
// (proveedor/ordenes/[id]/imprimir), así que ambos deben dar cifras idénticas:
// si tocas uno, toca el otro.

export default async function ImprimirOrdenCompradorPage({
  params,
}: {
  params: Promise<{ codigoCliente: string; id: string }>;
}) {
  const { codigoCliente, id } = await params;

  const cliente = getClienteByCodigo(codigoCliente);
  const empresa = getConfigEmpresa(codigoCliente);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orden: any = await db.ordenCompra.findUnique({
    where: { id },
    include: {
      licitacion: {
        // tiposCambio + monedaConsolidacion: sin ellos no se puede expresar la
        // equivalencia ni consolidar el total de una OC multi-moneda.
        select: {
          numero: true,
          jerarquia: true,
          tiposCambio: true,
          monedaConsolidacion: true,
        },
      },
      proveedor: { select: { razonSocial: true } },
      // Sin `select`: trae todos los escalares de OrdenCompraLinea, `moneda`
      // incluida (la congelada que viene de AsignacionMaterial.moneda).
      lineas: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!orden) notFound();

  const tiposCambio = parseTiposCambio(orden.licitacion.tiposCambio);
  const monedaConsolidacion: string = orden.licitacion.monedaConsolidacion ?? "MXN";
  const lineas = orden.lineas as { subtotal: number; moneda: string | null }[];

  // Total CONVERTIDO línea por línea antes de sumar: una OC puede mezclar
  // monedas y sumarlas en crudo daba una cifra sin significado.
  const total: number = lineas.reduce(
    (s, l) =>
      s + convertirAMoneda(l.subtotal, l.moneda ?? "MXN", monedaConsolidacion, tiposCambio),
    0
  );

  // Subtotales por moneda: solo informativos y solo si la OC mezcla monedas.
  const totalesPorMoneda = lineas.reduce<Record<string, number>>((acc, l) => {
    const moneda = l.moneda ?? "MXN";
    acc[moneda] = (acc[moneda] ?? 0) + l.subtotal;
    return acc;
  }, {});
  const hayVariasMonedas = Object.keys(totalesPorMoneda).length > 1;

  // Nota del TC congelado; null si toda la OC ya está en la moneda consolidada.
  const notaTC = notaTipoCambio(
    lineas.map((l) => l.moneda),
    tiposCambio,
    monedaConsolidacion
  );
  const hoy = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const badgeClass: Record<string, string> = {
    Pendiente:     "badge-pendiente",
    "En tránsito": "badge-transito",
    Entregada:     "badge-entregada",
    Recibida:      "badge-recibida",
    Cancelada:     "badge-cancelada",
  };

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          aside { display: none !important; }
          main { padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f4f4f5; }
          .print-wrap { background: white; max-width: 820px; margin: 0 auto; padding: 2rem; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
        }
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 8px 12px; border: 1px solid #e4e4e7; font-size: 13px; }
        th { background: #f4f4f5; font-weight: 600; color: #52525b; text-align: left; }
        .text-right { text-align: right; }
        tfoot td { background: #f4f4f5; font-weight: 700; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e4e4e7; }
        .meta-item label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; display: block; margin-bottom: 3px; }
        .meta-item span { font-size: 13px; color: #18181b; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
        .badge-pendiente { background: #f4f4f5; color: #52525b; }
        .badge-transito { background: #dbeafe; color: #1d4ed8; }
        .badge-entregada { background: #d1fae5; color: #065f46; }
        .badge-recibida { background: #a7f3d0; color: #064e3b; }
        .badge-cancelada { background: #fee2e2; color: #b91c1c; }
        .section-title { font-size: 14px; font-weight: 600; color: #52525b; margin: 20px 0 10px; }
        .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa; }
      `}</style>

      {/* Top bar (screen only) */}
      <div className="no-print" style={{ background:"#f4f4f5", borderBottom:"1px solid #e4e4e7", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"13px", fontWeight:500, color:"#52525b" }}>
          Vista previa — {orden.numero}
        </span>
        <div style={{ display:"flex", gap:"8px" }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ background:"#18181b", color:"white", border:"none", borderRadius:"6px", padding:"6px 14px", fontSize:"13px", fontWeight:500, cursor:"pointer" }}
          >
            Imprimir / Guardar PDF
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            style={{ background:"white", border:"1px solid #d4d4d8", borderRadius:"6px", padding:"6px 14px", fontSize:"13px", fontWeight:500, cursor:"pointer", color:"#3f3f46" }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="print-wrap">
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
          <div>
            {cliente?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cliente.logoUrl} alt={cliente.nombreEmpresa} style={{ height:"36px", marginBottom:"6px" }} />
            )}
            <p style={{ margin:0, fontSize:"13px", color:"#71717a" }}>{cliente?.nombreEmpresa}</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ margin:"0 0 2px", fontSize:"22px", fontWeight:700 }}>{orden.numero}</p>
            <p style={{ margin:0, fontSize:"13px", color:"#71717a" }}>Orden de Compra</p>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <label>Estatus</label>
            <span><span className={`badge ${badgeClass[orden.estado as string] ?? "badge-pendiente"}`}>{orden.estado}</span></span>
          </div>
          <div className="meta-item">
            <label>Licitación</label>
            <span>{orden.licitacion.numero}</span>
          </div>
          <div className="meta-item">
            <label>Criticidad</label>
            <span>{orden.licitacion.jerarquia ?? "—"}</span>
          </div>
          <div className="meta-item">
            <label>Proveedor</label>
            <span>{orden.proveedor.razonSocial}</span>
          </div>
          <div className="meta-item">
            <label>Fecha de creación</label>
            <span>{formatFecha(orden.fechaCreacion as Date)}</span>
          </div>
          <div className="meta-item">
            <label>ETD</label>
            <span>{formatFecha(orden.fechaEstimadaEntrega as Date | null)}</span>
          </div>
        </div>

        <p className="section-title">Materiales</p>
        <table>
          <thead>
            <tr>
              <th>Producto / Material</th>
              <th className="text-right">Cantidad</th>
              <th>U/M</th>
              <th className="text-right">Precio unitario</th>
              <th>Entrega objetivo</th>
              <th>Estimada proveedor</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(orden.lineas as any[]).map((l: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <tr key={l.id}>
                <td>{l.productoNombre}</td>
                <td className="text-right">{(l.cantidad as number).toLocaleString("es-MX")}</td>
                <td>{l.unidadMedida}</td>
                <td className="text-right">
                  {formatMontoConEquivalencia(
                    l.precioUnitario as number,
                    (l.moneda as string | null) ?? "MXN",
                    tiposCambio,
                    monedaConsolidacion
                  )}
                </td>
                <td>{formatFecha(l.fechaEntregaObjetivo as Date | null)}</td>
                <td>{formatFecha(l.fechaEstimadaProveedor as Date | null)}</td>
                <td className="text-right">
                  {formatMontoConEquivalencia(
                    l.subtotal as number,
                    (l.moneda as string | null) ?? "MXN",
                    tiposCambio,
                    monedaConsolidacion
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Subtotales por moneda: solo si la OC mezcla monedas. Dejan claro
                cuánto se debe en cada una antes de consolidar. */}
            {hayVariasMonedas &&
              Object.entries(totalesPorMoneda).map(([moneda, subtotal]) => (
                <tr key={moneda}>
                  <td colSpan={6} className="text-right" style={{ fontWeight: 500 }}>
                    Subtotal {moneda}
                  </td>
                  <td className="text-right" style={{ fontWeight: 500 }}>
                    {formatImporte(subtotal, moneda)}
                  </td>
                </tr>
              ))}
            <tr>
              <td colSpan={6} className="text-right">
                Total general{hayVariasMonedas ? ` (en ${monedaConsolidacion})` : ""}
              </td>
              <td className="text-right">{formatImporte(total, monedaConsolidacion)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Tipo de cambio congelado con el que se calcularon las equivalencias:
            en un documento contractual tiene que quedar asentado cuál se usó. */}
        {notaTC && (
          <p style={{ marginTop: "10px", fontSize: "11px", color: "#71717a" }}>
            {notaTC} · Tipo de cambio congelado al cierre de la licitación.
          </p>
        )}

        <div className="footer">Generado por {empresa.nombreComercial} · {hoy}</div>
      </div>
    </>
  );
}
