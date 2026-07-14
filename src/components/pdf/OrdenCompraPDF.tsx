import { Document, Text, View } from "@react-pdf/renderer";
import type { Cliente } from "@/src/config/clientes";
import { formatImporte } from "@/src/lib/monedas";
import PDFLayout from "./PDFLayout";
import { pdfStyles } from "./pdfStyles";
import { formatFechaPdf, nd } from "./pdfHelpers";

export type OrdenCompraPdfData = {
  numero: string;
  fechaCreacion: string | Date | null;
  estado: string;
  licitacionNumero: string | null;
  instrucciones: string | null;
  proveedor: {
    razonSocial: string;
    rfc: string | null;
    domicilio: string | null;
    vendedorNombre: string | null;
    vendedorCorreo: string | null;
  };
  lineas: {
    id: string;
    productoNombre: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    moneda: string;
    fechaEntregaObjetivo: string | Date | null;
    subtotal: number;
  }[];
};

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={pdfStyles.dato}>
      <Text style={pdfStyles.datoLabel}>{label}</Text>
      <Text style={pdfStyles.datoValor}>{valor}</Text>
    </View>
  );
}

export default function OrdenCompraPDF({
  cliente,
  orden,
}: {
  cliente: Cliente;
  orden: OrdenCompraPdfData;
}) {
  const totalesPorMoneda = orden.lineas.reduce(
    (acc, l) => {
      acc[l.moneda] = (acc[l.moneda] ?? 0) + l.subtotal;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Document title={`Orden de Compra ${orden.numero}`}>
      <PDFLayout cliente={cliente}>
        <Text style={pdfStyles.titulo}>Orden de Compra {orden.numero}</Text>
        <Text style={pdfStyles.subtitulo}>Licitación {nd(orden.licitacionNumero)}</Text>

        <View style={pdfStyles.seccion}>
          <View style={pdfStyles.filaDatos}>
            <Dato label="Fecha de emisión" valor={formatFechaPdf(orden.fechaCreacion)} />
            <Dato label="Estado" valor={nd(orden.estado)} />
            <Dato label="Comprador" valor={cliente.nombreEmpresa} />
          </View>
        </View>

        <View style={pdfStyles.seccion}>
          <Text style={pdfStyles.seccionTitulo}>Proveedor</Text>
          <View style={pdfStyles.filaDatos}>
            <Dato label="Razón social" valor={nd(orden.proveedor.razonSocial)} />
            <Dato label="RFC" valor={nd(orden.proveedor.rfc)} />
            <Dato label="Domicilio fiscal" valor={nd(orden.proveedor.domicilio)} />
            <Dato label="Contacto" valor={nd(orden.proveedor.vendedorNombre)} />
            <Dato label="Correo de contacto" valor={nd(orden.proveedor.vendedorCorreo)} />
          </View>
        </View>

        <View style={pdfStyles.seccion}>
          <Text style={pdfStyles.seccionTitulo}>Materiales</Text>
          <View style={pdfStyles.tabla}>
            <View style={pdfStyles.tablaHeaderRow}>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "26%" }]}>Producto</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "10%", textAlign: "right" }]}>
                Cantidad
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "10%" }]}>Unidad</Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "16%", textAlign: "right" }]}>
                Precio unitario
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "18%" }]}>
                Entrega comprometida
              </Text>
              <Text style={[pdfStyles.tablaHeaderCell, { width: "20%", textAlign: "right" }]}>
                Subtotal
              </Text>
            </View>
            {orden.lineas.map((l) => (
              <View key={l.id} style={pdfStyles.tablaRow} wrap={false}>
                <Text style={[pdfStyles.tablaCell, { width: "26%" }]}>{l.productoNombre}</Text>
                <Text style={[pdfStyles.tablaCell, { width: "10%", textAlign: "right" }]}>
                  {l.cantidad.toLocaleString("es-MX")}
                </Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "10%" }]}>{l.unidadMedida}</Text>
                <Text style={[pdfStyles.tablaCell, { width: "16%", textAlign: "right" }]}>
                  {formatImporte(l.precioUnitario, l.moneda)}
                </Text>
                <Text style={[pdfStyles.tablaCellMuted, { width: "18%" }]}>
                  {formatFechaPdf(l.fechaEntregaObjetivo)}
                </Text>
                <Text style={[pdfStyles.tablaCell, { width: "20%", textAlign: "right" }]}>
                  {formatImporte(l.subtotal, l.moneda)}
                </Text>
              </View>
            ))}
            {Object.entries(totalesPorMoneda).map(([moneda, total]) => (
              <View key={moneda} style={pdfStyles.tablaFooterRow}>
                <Text
                  style={[
                    pdfStyles.tablaCell,
                    { width: "80%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  Total ({moneda})
                </Text>
                <Text
                  style={[
                    pdfStyles.tablaCell,
                    { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {formatImporte(total, moneda)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {orden.instrucciones && (
          <View style={pdfStyles.seccion}>
            <Text style={pdfStyles.seccionTitulo}>Condiciones / Notas</Text>
            <Text style={{ fontSize: 8.5, color: "#3f3f46", lineHeight: 1.4 }}>
              {orden.instrucciones}
            </Text>
          </View>
        )}

        <View style={pdfStyles.firmas}>
          <View style={pdfStyles.firmaBloque}>
            <View style={pdfStyles.firmaLinea} />
            <Text style={pdfStyles.firmaLabel}>Comprador</Text>
          </View>
          <View style={pdfStyles.firmaBloque}>
            <View style={pdfStyles.firmaLinea} />
            <Text style={pdfStyles.firmaLabel}>Proveedor</Text>
          </View>
        </View>
      </PDFLayout>
    </Document>
  );
}
