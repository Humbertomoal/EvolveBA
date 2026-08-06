import type {
  FiltrosTablero,
  OpcionProducto,
} from "@/src/lib/tableroFiltros";
import type { FilaPareto } from "@/src/lib/tableroHistorico";

export type FiltrosDesempeno = FiltrosTablero;

export type DesempenoData = {
  proveedorNombre: string;
  /** true si un admin está viendo el portal como este proveedor. */
  esImpersonacion: boolean;

  kpis: {
    // ── Participación y conversión ──────────────────────────────────────────
    /** Licitaciones donde OFERTÓ al menos una vez. */
    participadas: number;
    /** Invitaciones recibidas — dato de contexto de la tarjeta anterior. */
    invitadas: number;
    /** Licitaciones donde se le asignó algo (sin contar rechazadas). */
    ganadas: number;
    tasaConversion: number | null;

    // ── Ahorro desde su lado ────────────────────────────────────────────────
    // montoVenta y montoMejorPrecio son EL MISMO número por construcción
    // (Σ cantidadAsignada × precioUnitario asignado). Se muestran los dos para
    // que la resta montoPrimeraRonda − montoMejorPrecio = ahorroGenerado cierre
    // a la vista del proveedor.
    montoVenta: number;
    montoPrimeraRonda: number;
    montoMejorPrecio: number;
    ahorroGenerado: number;
  };

  /** #8 — evolución del precio unitario vendido de un producto suyo. */
  variacionPrecio: {
    mes: string;
    etiqueta: string;
    precioPromedio: number | null;
    cantidad: number;
  }[];
  /** Producto graficado en #8 (el más vendido, o el elegido). */
  productoVariacion: string;
  /** Productos que ha vendido — opciones del selector de #8. */
  productosVendidos: OpcionProducto[];

  /** #9 — ranking por CANTIDAD, sin acumulado (mezcla unidades de medida). */
  cantidadPorProducto: {
    productoId: string;
    etiqueta: string;
    unidad: string;
    cantidad: number;
  }[];
  /** #10 — Pareto real: el monto sí es aditivo. */
  montoPorProducto: FilaPareto[];

  // ── Sobrecosto en lo que perdió ────────────────────────────────────────────
  /** #11 — Pareto real: el sobrecosto en dinero es aditivo. */
  sobrecostoMonto: FilaPareto[];
  /** #12 — ranking sin acumulado: los porcentajes no se suman entre productos. */
  sobrecostoPct: {
    productoId: string;
    etiqueta: string;
    porcentaje: number;
    materiales: number;
  }[];
  sobrecostoResumen: {
    totalMXN: number;
    perdidosTotal: number;
    /** Materiales donde ofertó más barato y aun así no ganó. */
    perdidosMasBaratos: number;
  };

  familiasOpciones: string[];
  productosOpciones: OpcionProducto[];
  hayProductosSinFamilia: boolean;
  periodo: { startDate: string; endDate: string };
};
