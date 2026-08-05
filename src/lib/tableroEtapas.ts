// ─────────────────────────────────────────────────────────────────────────────
// Tiempo por etapa del ciclo de licitación — lógica PURA (sin Prisma).
//
// Se alimenta de LicitacionEstadoLog, la bitácora que se venía escribiendo
// desde todos los caminos de transición sin que nadie la leyera.
//
// ── Máquina de estados real (los 12 call sites de registrarCambioEstado) ────
//   (null) ──────────────► Borrador | Programada        creación
//   Borrador ────────────► Programada | En Proceso      lanzamiento
//   Programada ──────────► En Proceso                   automática por tiempo
//   En Proceso ──────────► Esperando Decisión           fin de ronda
//   Esperando Decisión ──► En Proceso                   avance de ronda  ◄── CICLO
//   (En Proc|Esp Dec) ───► Cerrada
//   Cerrada ─────────────► Esperando Validación         asignación preliminar
//   (Esp Val|Cerrada) ───► Finalizada
//   (cualquiera) ────────► Cancelada
//
// ── Tres decisiones que hacen que el promedio signifique algo ───────────────
//
// 1. SUMAR POR LICITACIÓN ANTES DE PROMEDIAR. En Proceso ↔ Esperando Decisión
//    es un ciclo: una licitación de 3 rondas visita "En Proceso" tres veces.
//    Tratar cada visita como muestra independiente haría que la etapa se viera
//    artificialmente corta y que las licitaciones de muchas rondas pesaran el
//    triple. Se acumulan todas las visitas de una licitación en un solo valor,
//    y ese valor es UNA muestra.
//
// 2. EL ÚLTIMO REGISTRO NO SE CIERRA. Es el estado vigente; medirlo contra
//    "ahora" mezclaría tiempo transcurrido con tiempo consumido.
//
// 3. LOS HUECOS SE DESCARTAN, NO SE REPARTEN. registrarCambioEstado es
//    best-effort (traga sus errores para no tumbar la operación principal), así
//    que puede faltar una transición. Se detecta comparando
//    logs[i+1].estadoAnterior contra logs[i].estadoNuevo: si no empatan, el
//    intervalo abarca un número desconocido de etapas y atribuirlo a una sola
//    sería inventar. Se descarta y se cuenta para poder reportar cobertura.
// ─────────────────────────────────────────────────────────────────────────────

/** Forma mínima de una transición. Tipo propio y angosto: sin tipos de Prisma
 *  para que el módulo siga siendo importable desde el cliente. */
export type TransicionLog = {
  estadoAnterior: string | null;
  estadoNuevo: string;
  at: Date;
};

/**
 * Etapas con duración medible, en orden cronológico del ciclo de vida.
 * "Finalizada" y "Cancelada" son terminales: no tienen transición de salida,
 * así que no tienen duración y no se grafican.
 */
export const ETAPAS_MEDIBLES = [
  "Borrador",
  "Programada",
  "En Proceso",
  "Esperando Decisión",
  "Cerrada",
  "Esperando Validación",
] as const;

export type DuracionesLicitacion = {
  /** Milisegundos acumulados por etapa dentro de UNA licitación (suma de visitas). */
  porEtapa: Map<string, number>;
  /** Intervalos descartados por hueco en la bitácora. */
  huecos: number;
  /** true si aportó al menos un intervalo medible. */
  utilizable: boolean;
};

/**
 * Duraciones acumuladas por etapa de UNA licitación. Ver decisiones 1-3 arriba.
 */
export function duracionesPorLicitacion(logs: TransicionLog[]): DuracionesLicitacion {
  const porEtapa = new Map<string, number>();
  let huecos = 0;

  if (logs.length < 2) {
    // Con un solo registro (o ninguno) no hay intervalo que medir: la
    // licitación entró a un estado y todavía no salió de él según la bitácora.
    return { porEtapa, huecos, utilizable: false };
  }

  const ordenados = [...logs].sort((a, b) => a.at.getTime() - b.at.getTime());
  let utilizable = false;

  // Hasta length - 1: el último registro es el estado vigente y queda abierto.
  for (let i = 0; i < ordenados.length - 1; i++) {
    const actual = ordenados[i];
    const siguiente = ordenados[i + 1];

    // Hueco: la siguiente transición no arranca donde terminó la anterior.
    if (siguiente.estadoAnterior !== actual.estadoNuevo) {
      huecos++;
      continue;
    }

    const ms = siguiente.at.getTime() - actual.at.getTime();
    if (!Number.isFinite(ms) || ms < 0) {
      huecos++;
      continue;
    }

    porEtapa.set(actual.estadoNuevo, (porEtapa.get(actual.estadoNuevo) ?? 0) + ms);
    utilizable = true;
  }

  return { porEtapa, huecos, utilizable };
}

export type EtapaPromedio = {
  etapa: string;
  promedioHoras: number;
  /** Licitaciones que visitaron la etapa (denominador del promedio). */
  licitaciones: number;
};

export type ResumenEtapas = {
  etapas: EtapaPromedio[];
  /** Licitaciones que aportaron al menos un intervalo medible. */
  licitacionesUtilizables: number;
  /** Licitaciones del universo, tengan o no bitácora usable. */
  licitacionesTotales: number;
  intervalosDescartados: number;
};

const MS_POR_HORA = 3_600_000;

/**
 * Promedia por etapa a través de varias licitaciones. El denominador de cada
 * etapa son las licitaciones que la VISITARON, no el total: promediar "Esperando
 * Validación" sobre licitaciones que nunca pasaron por ahí la haría ver más
 * corta de lo que es.
 */
export function promediarEtapas(
  logsPorLicitacion: TransicionLog[][]
): ResumenEtapas {
  const acumulado = new Map<string, { totalMs: number; licitaciones: number }>();
  let licitacionesUtilizables = 0;
  let intervalosDescartados = 0;

  for (const logs of logsPorLicitacion) {
    const duraciones = duracionesPorLicitacion(logs);
    intervalosDescartados += duraciones.huecos;
    if (!duraciones.utilizable) continue;

    licitacionesUtilizables++;
    for (const [etapa, ms] of duraciones.porEtapa) {
      const acc = acumulado.get(etapa) ?? { totalMs: 0, licitaciones: 0 };
      acc.totalMs += ms;
      acc.licitaciones++; // una vez por licitación, no por visita (decisión 1)
      acumulado.set(etapa, acc);
    }
  }

  const etapas: EtapaPromedio[] = [];
  for (const etapa of ETAPAS_MEDIBLES) {
    const acc = acumulado.get(etapa);
    if (!acc || acc.licitaciones === 0) continue;
    etapas.push({
      etapa,
      promedioHoras:
        Math.round((acc.totalMs / acc.licitaciones / MS_POR_HORA) * 10) / 10,
      licitaciones: acc.licitaciones,
    });
  }

  return {
    etapas,
    licitacionesUtilizables,
    licitacionesTotales: logsPorLicitacion.length,
    intervalosDescartados,
  };
}

/** Duración legible: minutos por debajo de la hora, días por encima de 48 h. */
export function formatDuracionHoras(horas: number): string {
  if (!Number.isFinite(horas) || horas < 0) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas * 10) / 10} h`;
  return `${Math.round((horas / 24) * 10) / 10} d`;
}
