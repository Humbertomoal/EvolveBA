// ─────────────────────────────────────────────────────────────────────────────
// Filtros globales del Tablero de Indicadores — lógica PURA (sin Prisma).
//
// Vive aquí y no en tableroQueries.ts a propósito: lo consumen tanto el server
// component del tablero como TableroView (client component), que necesita
// serializar los filtros a la URL. tableroQueries.ts es server-only porque
// importa Prisma, así que NADA de este archivo puede depender de él.
//
// ── EL FILTRADO ES DE DOS NIVELES, y los dos son obligatorios ───────────────
//   1. Licitación (server, Prisma): construirWhereLicitacion() en
//      tableroQueries.ts trae las licitaciones con AL MENOS un material que
//      califica. Es el filtro grueso, para no traer de más.
//   2. Material (aquí, en memoria): itemPasaFiltro() descarta los materiales
//      que no califican ANTES de alimentar cualquier cálculo.
//
// Si se omite el paso 2 los KPIs mienten: filtrar por familia "TI" traería una
// licitación con 5 materiales de los que solo 2 son TI, y el ahorro sumaría los
// 5 bajo la etiqueta "TI". Todo indicador nuevo debe aplicar AMBOS niveles.
// ─────────────────────────────────────────────────────────────────────────────

export type FiltrosTablero = {
  period: string;
  dateFrom: string;
  dateTo: string;
  proveedorId: string;
  /** Criticidad de la licitación (Crítica/Alta/Media/Baja) — NO es la familia
   *  del producto. El campo se llama `jerarquia` en el modelo Licitacion. */
  jerarquia: string;
  /** Familia (categoría) del producto. SIN_FAMILIA = productos sin clasificar. */
  familia: string;
  productoId: string;

  // ── Grupo 3 (análisis histórico) ───────────────────────────────────────────
  // Cada indicador trae su PROPIA ventana temporal: el filtro `period` de
  // arriba no aplica a esa sección. Viajan en la URL para que el server pueda
  // calcular la ventana más ancha y resolver los cinco con una sola query.
  // Valores válidos en tableroHistorico.ts (VentanaHistorico).
  perAhorro: string;
  perMonto: string;
  perTop3: string;
  perCosto: string;
  perVariacion: string;
  /** Producto graficado por los indicadores de un solo producto (#3 y #5). */
  prodTop3: string;
  prodVariacion: string;
};

/**
 * Valor centinela del filtro de familia para "productos sin familia asignada".
 * Se necesita porque Producto.familia es nullable y "" ya significa "todas".
 */
export const SIN_FAMILIA = "__sin_familia__";

export const FILTROS_VACIOS: FiltrosTablero = {
  period: "last_week",
  dateFrom: "",
  dateTo: "",
  proveedorId: "",
  jerarquia: "",
  familia: "",
  productoId: "",
  // Prefiltros iniciales del Grupo 3.
  perAhorro: "6m",
  perMonto: "mes_anterior",
  perTop3: "mes_anterior",
  perCosto: "6m",
  perVariacion: "12m",
  prodTop3: "",
  prodVariacion: "",
};

// ── Periodo ──────────────────────────────────────────────────────────────────

/**
 * Rango de fechas del filtro de periodo. Se usa con lógica OR contra
 * fechaCreacion / fechaCerrada / fechaFinalizada (ver construirWhereLicitacion):
 * una licitación creada antes del rango pero cerrada dentro SÍ cuenta.
 */
export function resolverRangoFechas(filtros: FiltrosTablero): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = filtros.dateTo ? new Date(`${filtros.dateTo}T23:59:59`) : now;
  let startDate: Date;
  switch (filtros.period) {
    case "last_month":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case "last_3_months":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      break;
    case "custom":
      startDate = filtros.dateFrom
        ? new Date(`${filtros.dateFrom}T00:00:00`)
        : new Date(now.getTime() - 7 * 86_400_000);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
  }
  return { startDate, endDate };
}

// ── Agrupación mensual ───────────────────────────────────────────────────────
//
// Se resuelve en zona horaria de México (misma convención que dateUtils.ts): en
// UTC, una licitación cerrada el 1 de marzo a las 00:30 pertenece a marzo, pero
// en hora local de México son las 18:30 del 28 de febrero — y el usuario la
// espera en febrero.

const FORMATO_MES = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
});

/** Clave ordenable del mes de una fecha, p. ej. "2026-03". */
export function claveMes(fecha: Date): string {
  const partes = FORMATO_MES.formatToParts(fecha);
  const anio = partes.find((p) => p.type === "year")?.value ?? "0000";
  const mes = partes.find((p) => p.type === "month")?.value ?? "00";
  return `${anio}-${mes}`;
}

/** Etiqueta legible de una clave de mes, p. ej. "2026-03" → "mar 2026". */
export function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split("-");
  const fecha = new Date(Number(anio), Number(mes) - 1, 1);
  if (Number.isNaN(fecha.getTime())) return clave;
  return fecha.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}

// ── Nivel 2: filtro por material ─────────────────────────────────────────────

/**
 * Forma mínima que necesita itemPasaFiltro. Tipo propio y angosto (no importa
 * tipos de Prisma) para que este módulo siga siendo usable desde el cliente,
 * misma convención que LicitacionItemParaAhorro en licitacionesAhorro.ts.
 */
export type ItemFiltrable = {
  productoId: string;
  familia: string | null;
  productoEliminado: boolean;
};

/** Normaliza la familia: "" y espacios en blanco cuentan como "sin familia". */
export function normalizarFamilia(familia: string | null | undefined): string | null {
  const limpia = familia?.trim();
  return limpia ? limpia : null;
}

/**
 * ¿Este material entra en los indicadores con los filtros activos?
 * Aplica también la regla global de `eliminado`: un producto borrado nunca
 * cuenta, aunque su licitación siga viva.
 */
export function itemPasaFiltro(item: ItemFiltrable, filtros: FiltrosTablero): boolean {
  if (item.productoEliminado) return false;
  if (filtros.productoId && item.productoId !== filtros.productoId) return false;

  if (filtros.familia) {
    const familia = normalizarFamilia(item.familia);
    if (filtros.familia === SIN_FAMILIA) {
      if (familia !== null) return false;
    } else if (familia !== filtros.familia) {
      return false;
    }
  }
  return true;
}

// ── Formas de las opciones de los desplegables ───────────────────────────────
//
// Viven en el módulo PURO (y no junto a las queries que las producen) porque
// las consume TableroView, que es un client component. Así el cliente nunca
// tiene que importar —ni siquiera con `import type`— desde un módulo que
// arrastra Prisma.

export type OpcionProveedor = {
  id: string;
  nombre: string;
  /** true si está dado de baja pero se conserva por tener historial (regla 3). */
  inactivo: boolean;
};

export type OpcionProducto = {
  id: string;
  codigo: string;
  nombre: string;
  familia: string | null;
};

// ── Serialización a/desde la URL ─────────────────────────────────────────────
//
// Los nombres de los parámetros de URL se mantienen ("proveedor", "jerarquia")
// para no romper enlaces guardados, aunque los campos del tipo se llamen
// proveedorId/jerarquia. Este es el ÚNICO lugar donde vive ese mapeo: server y
// cliente lo comparten, así que agregar un filtro en fases futuras no requiere
// tocar dos listas que se pueden desincronizar.

const PARAM_POR_CAMPO: Record<keyof FiltrosTablero, string> = {
  period: "period",
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  proveedorId: "proveedor",
  jerarquia: "jerarquia",
  familia: "familia",
  productoId: "producto",
  perAhorro: "perAhorro",
  perMonto: "perMonto",
  perTop3: "perTop3",
  perCosto: "perCosto",
  perVariacion: "perVar",
  prodTop3: "prodTop3",
  prodVariacion: "prodVar",
};

export function filtrosDesdeSearchParams(
  sp: Record<string, string | string[] | undefined>
): FiltrosTablero {
  const leer = (param: string): string => {
    const valor = sp[param];
    if (Array.isArray(valor)) return valor[0] ?? "";
    return valor ?? "";
  };
  return {
    period: leer("period") || FILTROS_VACIOS.period,
    dateFrom: leer("dateFrom"),
    dateTo: leer("dateTo"),
    proveedorId: leer("proveedor"),
    jerarquia: leer("jerarquia"),
    familia: leer("familia"),
    productoId: leer("producto"),
    perAhorro: leer("perAhorro") || FILTROS_VACIOS.perAhorro,
    perMonto: leer("perMonto") || FILTROS_VACIOS.perMonto,
    perTop3: leer("perTop3") || FILTROS_VACIOS.perTop3,
    perCosto: leer("perCosto") || FILTROS_VACIOS.perCosto,
    perVariacion: leer("perVar") || FILTROS_VACIOS.perVariacion,
    prodTop3: leer("prodTop3"),
    prodVariacion: leer("prodVar"),
  };
}

export function filtrosAQueryString(filtros: FiltrosTablero): string {
  const params = new URLSearchParams();
  for (const [campo, param] of Object.entries(PARAM_POR_CAMPO) as [
    keyof FiltrosTablero,
    string,
  ][]) {
    const valor = filtros[campo];
    if (valor) params.set(param, valor);
  }
  return params.toString();
}
