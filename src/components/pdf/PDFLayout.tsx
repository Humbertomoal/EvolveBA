import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Cliente } from "@/src/config/clientes";

// ── Styles ────────────────────────────────────────────────────────────────────
// Nota: no usamos <Image> para el logo porque los logos de los clientes están
// en SVG (src/config/clientes.ts) y @react-pdf/renderer no soporta SVG externo.
// En su lugar mostramos una insignia con la inicial del cliente, igual al
// patrón que ya usa el resto de la app (ver el avatar de LoginForm.tsx).

const styles = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#27272a", // zinc-800
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 66,
    paddingHorizontal: 36,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  headerEmpresa: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#18181b", // zinc-900
  },
  headerBar: {
    height: 3,
    width: "100%",
  },
  headerBarWrap: {
    position: "absolute",
    top: 66,
    left: 0,
    right: 0,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    paddingHorizontal: 36,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7", // zinc-200
    fontSize: 8,
    color: "#71717a", // zinc-500
  },
});

function inicialDe(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}

function fechaGeneracion(): string {
  return new Date().toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Envoltorio de página con branding del cliente: header (insignia + nombre +
 * barra de color primario) y footer (paginación, fecha de generación y
 * nombre del cliente) fijos en cada página del documento.
 */
export default function PDFLayout({
  cliente,
  children,
}: {
  cliente: Cliente;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: cliente.colorPrimario }]}>
            <Text style={styles.badgeText}>{inicialDe(cliente.nombreEmpresa)}</Text>
          </View>
          <Text style={styles.headerEmpresa}>{cliente.nombreEmpresa}</Text>
        </View>
      </View>
      <View style={styles.headerBarWrap} fixed>
        <View style={[styles.headerBar, { backgroundColor: cliente.colorPrimario }]} />
      </View>

      {children}

      <View style={styles.footer} fixed>
        <Text
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
        <Text>Generado el {fechaGeneracion()}</Text>
        <Text>{cliente.nombreEmpresa}</Text>
      </View>
    </Page>
  );
}
