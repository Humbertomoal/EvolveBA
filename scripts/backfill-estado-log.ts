/**
 * Backfill de LicitacionEstadoLog — reconstruye la bitácora de estados de las
 * licitaciones existentes a partir de los timestamps por transición que YA
 * viven en el modelo Licitacion. De una sola vez.
 *
 * Mapeo (se saltan los nulos):
 *   fechaCreacion          → "Borrador"
 *   fechaInicioLicitacion  → "En Proceso"
 *   fechaEsperandoDecision → "Esperando Decisión"
 *   fechaCerrada           → "Cerrada"
 *   fechaFinalizada        → "Finalizada"
 *   fechaCancelada         → "Cancelada"
 *
 * - Entradas en orden cronológico; `estadoAnterior` encadenado según ese orden.
 * - `at` = el timestamp histórico real (no now()).
 * - usuarioId = null (reconstrucción de sistema).
 * - IDEMPOTENTE: si una licitación ya tiene registros en LicitacionEstadoLog,
 *   se salta (no duplica). Se puede correr varias veces sin problema.
 *
 * Correr con:  npx tsx scripts/backfill-estado-log.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from ".prisma/client/default";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ESTADO_ESPERANDO_DECISION = "Esperando Decisión";

type EntradaCronologica = { estadoNuevo: string; at: Date };

// Construye las entradas a partir de los timestamps presentes, en orden lógico;
// luego se ordenan por fecha real (estable) para respetar la cronología aunque
// algún timestamp viniera fuera del orden esperado.
function construirEntradas(lic: {
  fechaCreacion: Date | null;
  fechaInicioLicitacion: Date | null;
  fechaEsperandoDecision: Date | null;
  fechaCerrada: Date | null;
  fechaFinalizada: Date | null;
  fechaCancelada: Date | null;
}): EntradaCronologica[] {
  const candidatos: EntradaCronologica[] = [];
  if (lic.fechaCreacion) candidatos.push({ estadoNuevo: "Borrador", at: lic.fechaCreacion });
  if (lic.fechaInicioLicitacion)
    candidatos.push({ estadoNuevo: "En Proceso", at: lic.fechaInicioLicitacion });
  if (lic.fechaEsperandoDecision)
    candidatos.push({ estadoNuevo: ESTADO_ESPERANDO_DECISION, at: lic.fechaEsperandoDecision });
  if (lic.fechaCerrada) candidatos.push({ estadoNuevo: "Cerrada", at: lic.fechaCerrada });
  if (lic.fechaFinalizada) candidatos.push({ estadoNuevo: "Finalizada", at: lic.fechaFinalizada });
  if (lic.fechaCancelada) candidatos.push({ estadoNuevo: "Cancelada", at: lic.fechaCancelada });

  // Orden cronológico estable (Array.sort es estable en Node): los push ya van
  // en orden lógico, así que los empates de timestamp desempatan bien.
  candidatos.sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidatos;
}

async function main() {
  // Idempotencia: licitaciones que YA tienen bitácora → se saltan.
  const conLogs = await prisma.licitacionEstadoLog.findMany({
    select: { licitacionId: true },
    distinct: ["licitacionId"],
  });
  const yaProcesadas = new Set(conLogs.map((l) => l.licitacionId));

  const licitaciones = await prisma.licitacion.findMany({
    select: {
      id: true,
      numero: true,
      fechaCreacion: true,
      fechaInicioLicitacion: true,
      fechaEsperandoDecision: true,
      fechaCerrada: true,
      fechaFinalizada: true,
      fechaCancelada: true,
    },
    orderBy: { fechaCreacion: "asc" },
  });

  let procesadas = 0;
  let saltadas = 0;
  let sinTimestamps = 0;
  let entradasCreadas = 0;

  for (const lic of licitaciones) {
    if (yaProcesadas.has(lic.id)) {
      saltadas++;
      continue;
    }

    const entradas = construirEntradas(lic);
    if (entradas.length === 0) {
      // No debería pasar (fechaCreacion siempre existe), pero por robustez.
      sinTimestamps++;
      continue;
    }

    const rows = entradas.map((e, i) => ({
      licitacionId: lic.id,
      estadoAnterior: i === 0 ? null : entradas[i - 1].estadoNuevo,
      estadoNuevo: e.estadoNuevo,
      at: e.at,
      usuarioId: null,
    }));

    await prisma.licitacionEstadoLog.createMany({ data: rows });

    procesadas++;
    entradasCreadas += rows.length;
    console.log(
      `✓ Licitación ${lic.numero} (${lic.id}): ${rows.length} entrada(s) → ${entradas
        .map((e) => e.estadoNuevo)
        .join(" · ")}`
    );
  }

  console.log("\n──────────── Resumen backfill LicitacionEstadoLog ────────────");
  console.log(`Licitaciones totales:            ${licitaciones.length}`);
  console.log(`Procesadas (con entradas nuevas): ${procesadas}`);
  console.log(`Saltadas (ya tenían bitácora):    ${saltadas}`);
  if (sinTimestamps > 0) console.log(`Sin timestamps (omitidas):        ${sinTimestamps}`);
  console.log(`Entradas creadas:                 ${entradasCreadas}`);
  console.log("──────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("ERROR en backfill:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
