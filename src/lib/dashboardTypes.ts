// ─────────────────────────────────────────────────────────────────────────────
// Formas de datos del Dashboard de entrada (/comprador). Módulo PURO: 0 imports.
//
// ── Por qué vive separado de dashboardQueries.ts ───────────────────────────
// Blindaje pg/util-types. `dashboardQueries.ts` importa `prisma`, y de ahí
// cuelga toda la cadena `.prisma/client/default` → `@prisma/adapter-pg` → `pg`
// → `node:util`. Cualquier componente `"use client"` que importara un tipo
// desde ese módulo arrastraría esa cadena al bundle del navegador y el build
// tronaría.
//
// Por eso AhorroMensualChart.tsx —el único componente cliente del dashboard—
// importa sus tipos EXCLUSIVAMENTE de aquí. Misma convención que
// tablero/_components/types.ts, finalizadasTypes.ts y ordenesTypes.ts.
//
// Regla al editar: si alguna vez hace falta un `import` en este archivo, tiene
// que ser de otro módulo igualmente puro. Nunca Prisma, nunca server-only.
// ─────────────────────────────────────────────────────────────────────────────

/** Meses de historia que cubren el KPI de ahorro acumulado y la gráfica. */
export const MESES_VENTANA_AHORRO = 6;

// ── Gráfica ──────────────────────────────────────────────────────────────────

export type PuntoAhorroMes = {
  /** Clave ordenable "YYYY-MM", en zona horaria de México. */
  mes: string;
  /** Etiqueta legible, p. ej. "ago 2026". */
  etiqueta: string;
  /**
   * Ahorro del mes en MXN según el modelo NUEVO (`ahorroPromedioTotal`: línea
   * base de promedio de dos bolsas, ver ahorroPromedio.ts). No es el modelo
   * viejo que sigue pintando el Tablero de Indicadores.
   */
  ahorro: number;
};

// ── Métricas ─────────────────────────────────────────────────────────────────

/**
 * Conteos de licitaciones por CATEGORÍA VISIBLE (la de tableroCategorias.ts),
 * no por `Licitacion.estado` crudo. La diferencia importa: "Esperando Decisión"
 * no es un estado, es `esperandoDecision = true` sobre "En Proceso", y contar
 * por estado a secas hace que `enProceso` y `enCierre` se traslapen.
 */
export type ConteosLicitacion = {
  /** Borrador. */
  borradores: number;
  /** Programada. */
  porLanzar: number;
  /** En Proceso sin el flag: rondas de puja abiertas. */
  enProceso: number;
  /** En Proceso + flag, Cerrada y Esperando Validación. */
  enCierre: number;
  /**
   * Primera MITAD de `enCierre`: En Proceso + esperandoDecision. La puja
   * terminó y el comprador todavía no decide.
   */
  esperandoDecision: number;
  /**
   * Segunda mitad de `enCierre`: Cerrada + Esperando Validación, o sea lo que
   * la pantalla de Selección de Proveedores tiene por trabajar.
   *
   * Va aparte y no derivado de `enCierre` porque las dos mitades son acciones
   * DISTINTAS (decidir vs asignar) y cada una es su propio bloque de "necesita
   * atención". Invariante: esperandoDecision + listasParaAsignar === enCierre.
   */
  listasParaAsignar: number;
  /** Finalizada. */
  cerradas: number;
  /** Cancelada. */
  canceladas: number;
  /**
   * Vivas = porLanzar + enProceso + enCierre. Es una SUMA de las tres, así que
   * contiene a `enProceso`; la tarjeta lo dice en su subtexto para que no se
   * lea como un cuarto cubo disjunto.
   */
  activas: number;
  /** Suma de todas las categorías conocidas. */
  total: number;
  /**
   * Filas cuyo `estado` no mapeó a ninguna categoría conocida.
   * `clasificarLicitacion` devuelve null en ese caso a propósito, para que un
   * estado nuevo no infle en silencio un cubo equivocado. Si esto es > 0, hay
   * un valor de estado sin contemplar.
   */
  sinClasificar: number;
};

export type MetricasDashboard = {
  licitaciones: ConteosLicitacion;
  proveedoresActivos: number;
  proveedoresTotal: number;
  materiales: number;
  /** Ahorro acumulado en MXN de la ventana. Suma exacta de `ahorroMensual`. */
  ahorroTotal: number;
  /** ahorroTotal / línea base acumulada, en %. null si no hubo base. */
  ahorroPct: number | null;
  /** Cuántas licitaciones ejecutadas aportaron al ahorro de la ventana. */
  licitacionesConAhorro: number;
};

// ── "Lo que necesita tu atención" ────────────────────────────────────────────

/** Nombre lógico del ícono; el componente lo resuelve con un mapa explícito. */
export type IconoAtencion = "decision" | "asignar" | "ronda" | "orden";

export type TonoAtencion = "ambar" | "azul" | "rojo" | "neutral";

export type ItemAtencion = {
  id: string;
  /** Identificador visible: número de licitación o de orden. */
  titulo: string;
  /** Contexto secundario (criticidad, proveedor). Puede faltar. */
  subtitulo: string | null;
  /** Frase ya resuelta en el servidor, p. ej. "Lleva 3 d esperando". */
  detalle: string;
  href: string;
  /**
   * ISO del instante en que vence la ronda. Solo lo llena el bloque de rondas:
   * alimenta el <CountdownTimer>, que necesita un valor serializable porque
   * cruza a un componente cliente.
   */
  fechaLimite: string | null;
  /** Pinta el detalle en rojo: ya venció o está por vencer. */
  urgente: boolean;
};

export type BloqueAtencion = {
  clave: string;
  titulo: string;
  /** Se muestra cuando el bloque está vacío. */
  vacio: string;
  icono: IconoAtencion;
  tono: TonoAtencion;
  /** Total real, que puede ser mayor que `items.length`. */
  total: number;
  /** Muestra acotada (ver LIMITE_ITEMS_ATENCION). */
  items: ItemAtencion[];
  /** Destino del "Ver los N". */
  hrefTodos: string;
};

/** Cuántos items se listan por bloque antes de mandar al listado completo. */
export const LIMITE_ITEMS_ATENCION = 3;

// ── Payload completo ─────────────────────────────────────────────────────────

export type DashboardData = {
  metricas: MetricasDashboard;
  ahorroMensual: PuntoAhorroMes[];
  atencion: BloqueAtencion[];
  /**
   * Números de licitación a las que les falta el tipo de cambio de alguna
   * moneda en uso. Su importe se sumó a tasa 1 (retrocompatibilidad de
   * conversionMoneda.ts), o sea POR DEBAJO de su valor real. Se avisa en vez de
   * mentir en silencio.
   */
  avisoTiposCambio: string[];
};

// ── Formato ──────────────────────────────────────────────────────────────────

const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

/**
 * Antigüedad legible y corta ("3 d", "5 h", "12 min"). Redondea hacia abajo a
 * la unidad mayor: en una lista de pendientes interesa el orden de magnitud,
 * no el minuto exacto.
 */
export function formatAntiguedad(ms: number): string {
  const abs = Math.max(0, ms);
  if (abs >= MS_DIA) return `${Math.floor(abs / MS_DIA)} d`;
  if (abs >= MS_HORA) return `${Math.floor(abs / MS_HORA)} h`;
  return `${Math.floor(abs / MS_MINUTO)} min`;
}

/** Importe en MXN abreviado para tarjetas y ejes ("$1.2M", "$840.5K"). */
export function formatMontoCorto(monto: number): string {
  const signo = monto < 0 ? "-" : "";
  const abs = Math.abs(monto);
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${signo}$${(abs / 1_000).toFixed(1)}K`;
  return `${signo}$${abs.toFixed(0)}`;
}

/** Importe en MXN completo, con separadores de miles y sin decimales. */
export function formatMonto(monto: number): string {
  return `$${Math.round(monto).toLocaleString("es-MX")}`;
}
