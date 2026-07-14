import { Document, Text, View } from "@react-pdf/renderer";
import type { Cliente } from "@/src/config/clientes";
import { formatImporte } from "@/src/lib/monedas";
import PDFLayout from "./PDFLayout";
import { pdfStyles } from "./pdfStyles";
import { formatFechaPdf, nd } from "./pdfHelpers";

export type ComparativoOfertasPdfData = {
  numero: string;
  jerarquia: string | null;
  fechaEjecucion: string | Date | null;
  fechaFinLicitacion: string | Date | null;
  monedaPredominante: string;
  indicadores: {
    presupuestoObjetivoTotal: number;
    primeraRondaTotal: number;
    mejorPrecioActualTotal: number;
    adherenciaPct: number;
    ahorroTotal: number;
    ahorroPct: number | null;
  };
  materiales: {
    id: string;
    productoNombre: string;
    moneda: string;
    objetivoUnitario: number | null;
    primeraRondaUnitario: number | null;
    mejorActualUnitario: number | null;
    variacionPct: number | null;
    ahorroTotal: number | null;
    proveedorGanador: string | null;
  }[];
  historial: {
    proveedores: { id: string; nombre: string }[];
    materiales: {
      id: string;
      productoNombre: string;
      moneda: string;
      filas: { ronda: number; precios: Record<string, number | null> }[];
    }[];
  } | null;
};

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={{ width: "23%", marginBottom: 8 }}>
      <Text style={pdfStyles.datoLabel}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#18181b" }}>
        {valor}
      </Text>
    </View>
  );
}

function formatPct(pct: number | null): string {
  if (pct == null || isNaN(pct)) return "N/A";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export default function ComparativoOfertasPDF({
  cliente,
  licitacion,
}: {
  cliente: Cliente;
  licitacion: ComparativoOfertasPdfData;
}) {
  const moneda = licitacion.monedaPredominante;
  const { indicadores } = licitacion;

  return (
    <Document title={`Comparativo de Ofertas ${licitacion.numero}`}>
      <PDFLayout cliente={cliente}>
        <Text style={pdfStyles.titulo}>Comparativo de Ofertas — Licitación {licitacion.numero}</Text>
        <Text style={pdfStyles.subtitulo}>
          {nd(licitacion.jerarquia)} · {formatFechaPdf(licitacion.fechaEjecucion)} —{" "}
          {formatFechaPdf(licitacion.fechaFinLicitacion)}
        </Text>

        <View style={[pdfStyles.seccion, { flexDirection: "row", flexWrap: "wrap" }]}>
          <Kpi
            label="Presupuesto Objetivo"
            valor={formatImporte(indicadores.presupuestoObjetivoTotal, moneda)}
          />
          <Kpi
            label="Total Primera Ronda"
            valor={formatImporte(indicadores.primeraRondaTotal, moneda)}
          />
          <Kpi
            label="Mejor Precio Actual"
            valor={formatImporte(indicadores.mejorPrecioActualTotal, moneda)}
          />
          <Kpi label="Adherencia de Precio" valor={`${indicadores.adherenciaPct.toFixed(1)}%`} />
          <Kpi
            label="Ahorro"
            valor={`${formatImporte(indicadores.ahorroTotal, moneda)} (${formatPct(
              indicadores.ahorroPct
            )})`}
          />
        </View>

        <View style={pdfStyles.seccion}>
          <Text style={pdfStyles.seccionTitulo}>Comparativo por material</Text>
          <View style={pdfStyles.tabla}>
            <View style={pdfStyles.tablaHeaderRow}>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "20%" }]}>Material</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "12%", textAlign: "right" }]}>
                Objetivo
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "13%", textAlign: "right" }]}>
                1ª Ronda
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "13%", textAlign: "right" }]}>
                Mejor Actual
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "10%", textAlign: "right" }]}>
                Variación
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "12%", textAlign: "right" }]}>
                Ahorro
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "20%" }]}>Proveedor ganador</Text>
            </View>
            {licitacion.materiales.map((m) => (
              <View key={m.id} style={pdfStyles.tablaRow} wrap={false}>
                <Text style={[pdfStyles.tablaCell, { width: "20%" }]}>{m.productoNombre}</Text>
                <Text style={[pdfStyles.tablaCell, { width: "12%", textAlign: "right" }]}>
                  {m.objetivoUnitario != null ? formatImporte(m.objetivoUnitario, m.moneda) : "N/A"}
                </Text>
                <Text style={[pdfStyles.tablaCell, { width: "13%", textAlign: "right" }]}>
                  {m.primeraRondaUnitario != null
                    ? formatImporte(m.primeraRondaUnitario, m.moneda)
                    : "N/A"}
                </Text>
                <Text style={[pdfStyles.tablaCell, { width: "13%", textAlign: "right" }]}>
                  {m.mejorActualUnitario != null
                    ? formatImporte(m.mejorActualUnitario, m.moneda)
                    : "N/A"}
                </Text>
                <Text style={[pdfStyles.tablaCell, { width: "10%", textAlign: "right" }]}>
                  {formatPct(m.variacionPct)}
                </Text>
                <Text style={[pdfStyles.tablaCell, { width: "12%", textAlign: "right" }]}>
                  {m.ahorroTotal != null ? formatImporte(m.ahorroTotal, m.moneda) : "N/A"}
                </Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "20%" }]}>
                  {nd(m.proveedorGanador)}
                </Text>
              </View>
            ))}
            <View style={pdfStyles.tablaFooterRow}>
              <Text
                style={[
                  pdfStyles.tablaCell,
                  { width: "45%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                Total general
              </Text>
              <Text
                style={[
                  pdfStyles.tablaCell,
                  { width: "13%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {formatImporte(indicadores.primeraRondaTotal, moneda)}
              </Text>
              <Text
                style={[
                  pdfStyles.tablaCell,
                  { width: "13%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {formatImporte(indicadores.mejorPrecioActualTotal, moneda)}
              </Text>
              <Text style={[pdfStyles.tablaCell, { width: "10%" }]} />
              <Text
                style={[
                  pdfStyles.tablaCell,
                  { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {formatImporte(indicadores.ahorroTotal, moneda)}
              </Text>
              <Text style={[pdfStyles.tablaCell, { width: "20%" }]} />
            </View>
          </View>
        </View>

        {licitacion.historial && licitacion.historial.materiales.length > 0 && (
          <View style={pdfStyles.seccion} break>
            <Text style={pdfStyles.seccionTitulo}>Historial de pujas por ronda</Text>
            {licitacion.historial.materiales.map((mat) => {
              const proveedores = licitacion.historial!.proveedores;
              const colProveedor = proveedores.length > 0 ? 72 / proveedores.length : 72;
              return (
                <View key={mat.id} style={{ marginBottom: 10 }} wrap={false}>
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#3f3f46", marginBottom: 3 }}>
                    {mat.productoNombre}
                  </Text>
                  <View style={pdfStyles.tabla}>
                    <View style={pdfStyles.tablaHeaderRow}>
                      <Text style={[pdfStyles.tablaHeaderCell, { width: "8%" }]}>Ronda</Text>
                      {proveedores.map((p) => (
                        <Text
                          key={p.id}
                          style={[
                            pdfStyles.tablaHeaderCell,
                            { width: `${colProveedor}%`, textAlign: "right" },
                          ]}
                        >
                          {p.nombre}
                        </Text>
                      ))}
                      <Text style={[pdfStyles.tablaHeaderCell, { width: "20%" }]}></Text>
                    </View>
                    {mat.filas.map((fila) => (
                      <View key={fila.ronda} style={pdfStyles.tablaRow} wrap={false}>
                        <Text style={[pdfStyles.tablaCell, { width: "8%" }]}>{fila.ronda}</Text>
                        {proveedores.map((p) => (
                          <Text
                            key={p.id}
                            style={[
                              pdfStyles.tablaCell,
                              { width: `${colProveedor}%`, textAlign: "right" },
                            ]}
                          >
                            {fila.precios[p.id] != null
                              ? formatImporte(fila.precios[p.id]!, mat.moneda)
                              : "—"}
                          </Text>
                        ))}
                        <Text style={[pdfStyles.tablaCell, { width: "20%" }]}></Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </PDFLayout>
    </Document>
  );
}
