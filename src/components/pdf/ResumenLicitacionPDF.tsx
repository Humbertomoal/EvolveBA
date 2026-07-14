import { Document, Text, View } from "@react-pdf/renderer";
import type { Cliente } from "@/src/config/clientes";
import { formatImporte } from "@/src/lib/monedas";
import PDFLayout from "./PDFLayout";
import { pdfStyles } from "./pdfStyles";
import { formatFechaPdf, nd } from "./pdfHelpers";

export type ResumenLicitacionPdfData = {
  numero: string;
  jerarquia: string | null;
  tipoLicitacion: string | null;
  estado: string;
  modoLicitacion: string;
  fechaEjecucion: string | Date | null;
  fechaFinLicitacion: string | Date | null;
  fechaInicioRangoEntrega: string | Date | null;
  fechaFinRangoEntrega: string | Date | null;
  costoObjetivo: number | null;
  monedaPredominante: string;
  instrucciones: string | null;
  materiales: {
    id: string;
    productoNombre: string;
    cantidadSolicitada: number;
    unidadMedida: string;
    moneda: string;
    fechaEntrega: string | Date | null;
  }[];
  proveedores: { id: string; razonSocial: string }[];
  resultado: {
    porMaterial: {
      id: string;
      productoNombre: string;
      ganadorNombre: string | null;
      precioFinal: number | null;
      moneda: string;
      ahorro: number | null;
    }[];
  } | null;
};

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={pdfStyles.dato}>
      <Text style={pdfStyles.datoLabel}>{label}</Text>
      <Text style={pdfStyles.datoValor}>{valor}</Text>
    </View>
  );
}

export default function ResumenLicitacionPDF({
  cliente,
  licitacion,
}: {
  cliente: Cliente;
  licitacion: ResumenLicitacionPdfData;
}) {
  return (
    <Document title={`Resumen de Licitación ${licitacion.numero}`}>
      <PDFLayout cliente={cliente}>
        <Text style={pdfStyles.titulo}>Resumen de Licitación {licitacion.numero}</Text>
        <Text style={pdfStyles.subtitulo}>{cliente.nombreEmpresa}</Text>

        <View style={pdfStyles.seccion}>
          <View style={pdfStyles.filaDatos}>
            <Dato label="Criticidad" valor={nd(licitacion.jerarquia)} />
            <Dato label="Tipo de compra" valor={nd(licitacion.tipoLicitacion)} />
            <Dato label="Estado" valor={nd(licitacion.estado)} />
            <Dato label="Modo" valor={nd(licitacion.modoLicitacion)} />
            <Dato label="Inicio de licitación" valor={formatFechaPdf(licitacion.fechaEjecucion)} />
            <Dato label="Fin de licitación" valor={formatFechaPdf(licitacion.fechaFinLicitacion)} />
            <Dato
              label="Rango de entrega"
              valor={`${formatFechaPdf(licitacion.fechaInicioRangoEntrega)} — ${formatFechaPdf(
                licitacion.fechaFinRangoEntrega
              )}`}
            />
            <Dato
              label="Presupuesto objetivo"
              valor={
                licitacion.costoObjetivo != null
                  ? formatImporte(licitacion.costoObjetivo, licitacion.monedaPredominante)
                  : "N/A"
              }
            />
          </View>
        </View>

        <View style={pdfStyles.seccion}>
          <Text style={pdfStyles.seccionTitulo}>Materiales solicitados</Text>
          <View style={pdfStyles.tabla}>
            <View style={pdfStyles.tablaHeaderRow}>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "34%" }]}>Producto</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "14%", textAlign: "right" }]}>
                Cantidad
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "14%" }]}>Unidad</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "14%" }]}>Moneda</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "24%" }]}>Fecha requerida</Text>
            </View>
            {licitacion.materiales.map((m) => (
              <View key={m.id} style={pdfStyles.tablaRow} wrap={false}>
                <Text style={[pdfStyles.tablaCell, { width: "34%" }]}>{m.productoNombre}</Text>
                <Text style={[pdfStyles.tablaCell, { width: "14%", textAlign: "right" }]}>
                  {m.cantidadSolicitada.toLocaleString("es-MX")}
                </Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "14%" }]}>{m.unidadMedida}</Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "14%" }]}>{m.moneda}</Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "24%" }]}>
                  {formatFechaPdf(m.fechaEntrega)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={pdfStyles.seccion}>
          <Text style={pdfStyles.seccionTitulo}>Proveedores invitados</Text>
          {licitacion.proveedores.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: "#71717a" }}>N/A</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {licitacion.proveedores.map((p) => (
                <Text key={p.id} style={pdfStyles.badge}>
                  {p.razonSocial}
                </Text>
              ))}
            </View>
          )}
        </View>

        {licitacion.instrucciones && (
          <View style={pdfStyles.seccion}>
            <Text style={pdfStyles.seccionTitulo}>Instrucciones</Text>
            <Text style={{ fontSize: 8.5, color: "#3f3f46", lineHeight: 1.4 }}>
              {licitacion.instrucciones}
            </Text>
          </View>
        )}

        {licitacion.resultado && (
          <View style={pdfStyles.seccion} break>
            <Text style={pdfStyles.seccionTitulo}>Resultado — Ganadores por material</Text>
            <View style={pdfStyles.tabla}>
              <View style={pdfStyles.tablaHeaderRow}>
                <Text style={[pdfStyles.tablaHeaderCell, { width: "34%" }]}>Producto</Text>
                <Text style={[pdfStyles.tablaHeaderCell, { width: "26%" }]}>
                  Proveedor ganador
                </Text>
                <Text style={[pdfStyles.tablaHeaderCell, { width: "20%", textAlign: "right" }]}>
                  Precio final
                </Text>
                <Text style={[pdfStyles.tablaHeaderCell, { width: "20%", textAlign: "right" }]}>
                  Ahorro
                </Text>
              </View>
              {licitacion.resultado.porMaterial.map((r) => (
                <View key={r.id} style={pdfStyles.tablaRow} wrap={false}>
                  <Text style={[pdfStyles.tablaCell, { width: "34%" }]}>{r.productoNombre}</Text>
                  <Text style={[pdfStyles.tablaCellMuted, { width: "26%" }]}>
                    {nd(r.ganadorNombre)}
                  </Text>
                  <Text style={[pdfStyles.tablaCell, { width: "20%", textAlign: "right" }]}>
                    {r.precioFinal != null ? formatImporte(r.precioFinal, r.moneda) : "N/A"}
                  </Text>
                  <Text style={[pdfStyles.tablaCell, { width: "20%", textAlign: "right" }]}>
                    {r.ahorro != null ? formatImporte(r.ahorro, r.moneda) : "N/A"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </PDFLayout>
    </Document>
  );
}
