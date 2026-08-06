// ─────────────────────────────────────────────────────────────────────────────
// Análisis histórico (Grupo 3) — lógica PURA (sin Prisma).
//
// A diferencia del resto del tablero, cada indicador de esta sección tiene su
// PROPIA ventana temporal y el filtro global de periodo NO aplica. Los cinco
// valores viven en la URL, así que el server los conoce todos: calcula la
// ventana más ancha, hace UNA sola query, y recorta en memoria por indicador
// con las funciones de este archivo.
// ─────────────────────────────────────────────────────────────────────────────

import { claveMes } from "./tableroFiltros";

export type VentanaHistorico = "mes_anterior" | "3m" | "6m" | "12m" | "24m";

export const VENTANAS: { valor: VentanaHistorico; label: string }[] = [
  { valor: "mes_anterior", label: "Mes anterior" },
  { valor: "3m", label: "Últimos 3 meses" },
  { valor: "6m", label: "Últimos 6 meses" },
  { valor: "12m", label: "Últimos 12 meses" },
  { valor: "24m", label: "Últimos 24 meses" },
];

const MESES_POR_VENTANA: Record<Exclude<VentanaHistorico, "mes_anterior">, number> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
  "24m": 24,
};

export function esVentanaValida(valor: string): valor is VentanaHistorico {
  return VENTANAS.some((v) => v.valor === valor);
}

// América/México_City es UTC-6 fijo (sin horario de verano desde 2022). Se usa
// el offset explícito para que los límites de "mes anterior" coincidan con los
// buckets de claveMes(), que también resuelve en hora de México: si no, una
// compra a las 23:00 UTC del día 1 caería en un mes distinto al de su barra.
const OFFSET_MX_HORAS = 6;

function inicioDeMesMX(anio: number, mesIndex: number): Date {
  // Date.UTC normaliza índices fuera de rango (mes -1 = diciembre del año previo).
  return new Date(Date.UTC(anio, mesIndex, 1, OFFSET_MX_HORAS, 0, 0, 0));
}

export type Ventana = { desde: Date; hasta: Date };

/**
 * Rango de una ventana. "mes_anterior" es el MES CALENDARIO completo anterior
 * (si hoy es 5 de agosto → 1–31 de julio), no "últimos 30 días". Las demás son
 * ventanas móviles que terminan ahora.
 */
export function resolverVentana(ventana: VentanaHistorico, ahora: Date): Ventana {
  if (ventana === "mes_anterior") {
    const [anio, mes] = claveMes(ahora).split("-").map(Number);
    // `mes` viene 1-12; el índice 0-based del mes anterior es mes - 2.
    const desde = inicioDeMesMX(anio, mes - 2);
    const hasta = new Date(inicioDeMesMX(anio, mes - 1).getTime() - 1);
    return { desde, hasta };
  }
  const desde = new Date(ahora);
  desde.setMonth(desde.getMonth() - MESES_POR_VENTANA[ventana]);
  return { desde, hasta: ahora };
}

/** El `desde` más antiguo entre varias ventanas — define la única query. */
export function inicioMasAntiguo(ventanas: VentanaHistorico[], ahora: Date): Date {
  const inicios = ventanas.map((v) => resolverVentana(v, ahora).desde.getTime());
  return new Date(inicios.length > 0 ? Math.min(...inicios) : ahora.getTime());
}

export function dentroDe(fecha: Date, ventana: Ventana): boolean {
  const t = fecha.getTime();
  return t >= ventana.desde.getTime() && t <= ventana.hasta.getTime();
}

/**
 * Fecha que ubica una compra en el tiempo. Misma precedencia que usa la gráfica
 * de ahorro mensual del Grupo 1 — factorizada aquí para que no existan dos
 * criterios que se puedan desincronizar.
 */
export function fechaDeCompra(lic: {
  fechaCerrada: Date | null;
  fechaFinalizada: Date | null;
  fechaCreacion: Date;
}): Date {
  return lic.fechaCerrada ?? lic.fechaFinalizada ?? lic.fechaCreacion;
}

/**
 * Claves de mes que cubre una ventana, en orden. La gráfica de variación las
 * usa para dibujar el eje completo: un mes sin compras debe aparecer como hueco
 * y no desaparecer del eje, o la línea daría la impresión de continuidad donde
 * no la hubo.
 */
export function mesesEntre(ventana: Ventana): string[] {
  const claves: string[] = [];
  const cursor = new Date(ventana.desde);
  cursor.setDate(1);
  while (cursor.getTime() <= ventana.hasta.getTime()) {
    const clave = claveMes(cursor);
    if (claves[claves.length - 1] !== clave) claves.push(clave);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return claves;
}

// ── Promedio ponderado ───────────────────────────────────────────────────────

export type FilaPonderada = { montoMXN: number; cantidad: number };

/**
 * Precio unitario promedio PONDERADO por cantidad: Σmonto / Σcantidad.
 *
 * El promedio simple mentiría: un proveedor con 1 pieza a $10 y otro con 1000 a
 * $100 daría $55, que no describe ninguna compra real. Como la conversión de
 * moneda es lineal, ponderar sobre subtotales ya convertidos a MXN equivale a
 * convertir cada precio unitario, y permite reusar la fórmula canónica de monto.
 */
export function promedioPonderado(filas: FilaPonderada[]): number | null {
  let monto = 0;
  let cantidad = 0;
  for (const f of filas) {
    monto += f.montoMXN;
    cantidad += f.cantidad;
  }
  return cantidad > 0 ? monto / cantidad : null;
}

export function acumularPonderado(acc: FilaPonderada, fila: FilaPonderada): void {
  acc.montoMXN += fila.montoMXN;
  acc.cantidad += fila.cantidad;
}

// ── Pareto ───────────────────────────────────────────────────────────────────

export type FilaPareto = {
  id: string;
  etiqueta: string;
  valor: number;
  /** % del total acumulado hasta esta fila, inclusive (0-100). */
  porcentajeAcumulado: number;
};

/**
 * Ordena desc y calcula el acumulado. SOLO tiene sentido con magnitudes
 * ADITIVAS (ahorro, monto): acumular precios unitarios no significa nada,
 * porque no se suman entre productos. Por eso el costo unitario promedio se
 * grafica como ranking simple y no pasa por aquí.
 */
export function construirPareto(
  filas: { id: string; etiqueta: string; valor: number }[]
): FilaPareto[] {
  const positivas = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = positivas.reduce((s, f) => s + f.valor, 0);
  if (total <= 0) return [];

  let acumulado = 0;
  return positivas.map((f) => {
    acumulado += f.valor;
    return {
      id: f.id,
      etiqueta: f.etiqueta,
      valor: f.valor,
      porcentajeAcumulado: Math.round((acumulado / total) * 1000) / 10,
    };
  });
}

// ── Producto más comprado ────────────────────────────────────────────────────

/**
 * Producto con mayor monto asignado. Alimenta el prefiltro de los indicadores
 * que grafican UN producto (#3 y #5). Devuelve null si no hay compras: el call
 * site debe caer a la ventana más ancha antes de rendirse, para no arrancar con
 * una gráfica vacía sin explicación.
 */
export function productoTopPorMonto(
  montos: Map<string, number>
): string | null {
  let top: string | null = null;
  let mejor = -Infinity;
  for (const [productoId, monto] of montos) {
    if (monto > mejor) {
      mejor = monto;
      top = productoId;
    }
  }
  return mejor > 0 ? top : null;
}

/** Estado de asignación que NO representa una compra (el proveedor la rechazó). */
export const ESTATUS_ASIGNACION_RECHAZADO = "Rechazado";

export function asignacionCuenta(estatusProveedor: string): boolean {
  return estatusProveedor !== ESTATUS_ASIGNACION_RECHAZADO;
}
