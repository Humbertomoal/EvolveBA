import { StyleSheet } from "@react-pdf/renderer";

/** Estilos compartidos entre los documentos PDF (tablas, secciones, firmas). */
export const pdfStyles = StyleSheet.create({
  titulo: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 2,
  },
  subtitulo: {
    fontSize: 9,
    color: "#71717a",
    marginBottom: 14,
  },
  seccion: {
    marginBottom: 14,
  },
  seccionTitulo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#18181b",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  filaDatos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  dato: {
    marginBottom: 5,
    minWidth: 130,
  },
  datoLabel: {
    fontSize: 7.5,
    color: "#a1a1aa",
    marginBottom: 1,
  },
  datoValor: {
    fontSize: 9,
    color: "#27272a",
  },
  tabla: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 2,
  },
  tablaHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f9f7f7",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  tablaHeaderCell: {
    padding: 5,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#71717a",
  },
  tablaRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  tablaCell: {
    padding: 5,
    fontSize: 8.5,
    color: "#27272a",
  },
  tablaCellMuted: {
    padding: 5,
    fontSize: 8.5,
    color: "#71717a",
  },
  tablaFooterRow: {
    flexDirection: "row",
    backgroundColor: "#f9f7f7",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
  },
  badge: {
    fontSize: 7.5,
    color: "#3f3f46",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  firmas: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  firmaBloque: {
    width: "42%",
    alignItems: "center",
  },
  firmaLinea: {
    borderTopWidth: 1,
    borderTopColor: "#a1a1aa",
    width: "100%",
    marginBottom: 4,
  },
  firmaLabel: {
    fontSize: 8,
    color: "#71717a",
  },
});
