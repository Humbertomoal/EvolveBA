/**
 * Crea la licitación PRUEBA-DEMO para grabar el video que explica a los
 * proveedores cómo cotizar en el portal (incluido el autollenado de precios).
 *
 * Correr:
 *   npx tsx scripts/crear-licitacion-prueba-demo.ts                → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/crear-licitacion-prueba-demo.ts --apply        → escribe (pide confirmación)
 *   npx tsx scripts/crear-licitacion-prueba-demo.ts --apply --yes  → escribe sin preguntar
 *
 * Se borra con scripts/sql/prueba_grupos_limpieza.sql (lo corre el usuario).
 * OJO: esa limpieza borra TODAS las licitaciones de prueba a la vez
 * (PRUEBA-GRUPOS*, PRUEBA-AUTOLLENADO y PRUEBA-DEMO).
 * NO es repetible: si PRUEBA-DEMO ya existe, aborta sin escribir.
 *
 * ── Qué crea ───────────────────────────────────────────────────────────────
 * Los 4 grupos reales con el domicilio y las coordenadas LEÍDOS de la
 * licitación 0029 (no copiados a mano), en su mismo orden. 15 partidas, todas
 * en MXN:
 *   · 2 materiales en los 4 grupos      → el autollenado copia a los otros 3
 *   · 1 material en 2 grupos             → copia solo a donde existe
 *   · 1 material en un solo grupo        → no tiene a dónde copiar
 *   · FLETE (SP-FDE-001) en cada grupo   → no se autollena (cambia por sitio)
 * Invitado SOLO Proveedor2. Todos los materiales deben estar en su catálogo.
 *
 * ── Cómo escribe (sin mandar correos) ──────────────────────────────────────
 * Igual que crear-licitacion-prueba-autollenado.ts: acciones reales con auth y
 * next/cache simulados (scripts/lib/stubsServidor.ts).
 *   1. crearLicitacionAction  → Borrador, con grupos, partidas e invitado.
 *   2. lanzarLicitacionAction → Programada. No envía correos (los manda el
 *      modal del navegador ANTES de llamarla; aquí no hay modal).
 *   3. Arranque: el inicio es en 5 minutos, así que queda Programada. Pasa a
 *      En Proceso (ronda 1) la primera vez que alguien abre la licitación o la
 *      lista, en el portal o del lado del comprador, después de esa hora
 *      (verificarYActualizarEstado). Eso publica el aviso "ronda 1" en el CHAT
 *      del portal (no es correo).
 * Al final se comprueba que el módulo de correo (emailService) no se cargó.
 *
 * ── Fechas ─────────────────────────────────────────────────────────────────
 * · Inicio: ahora + 5 min. Rondas: 3 de 30 días. Cierre por reloj: lo decide
 *   la duración de la ronda, no la fecha fin; fin = inicio + 90 días para que
 *   cuadre con las rondas.
 * · Fecha requerida de las 15 partidas: FECHA_ENTREGA fija (15/03/2027), DESPUÉS
 *   de la fecha fin, como exige el formulario. Rango de entrega = ese mismo
 *   día. Si el fin cayera en o después de esa fecha, el script no escribe.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { instalarStubsServidor, verificarQueNoSeCargoLoReal } from "./lib/stubsServidor";
import type { GrupoInput, ItemInput, LicitacionInput } from "../src/lib/licitacionInputTypes";

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const BASE_PATH = "/evolve-ba";

const NUMERO = "PRUEBA-DEMO";
const NUMERO_ORIGEN_GRUPOS = "0029";
const CORREO_DUENO = "humberto.morales@evolveba.com.mx";
const PROVEEDOR_ID = "cmscfvbu3000104l95apfjnv5"; // Proveedor2 (cuenta de prueba; su correo es del comprador)

const MINUTOS_PARA_INICIO = 5;
const DURACION_RONDA_MINUTOS = 30 * 24 * 60;
const MAX_RONDAS = 3;
const FECHA_ENTREGA = "2027-03-15";
const TOTAL_ESPERADO = 15;

/** Grupos de la 0029, en su orden. Se leen nombre, domicilio y coordenadas. */
const GRUPOS_0029 = ["La Mesa", "Planta Pilas", "Pringón", "Yerba Buena 3"] as const;
type Grupo = (typeof GRUPOS_0029)[number];

/** Partidas por grupo, en orden de pantalla: [código, cantidad]. Flete se agrega al final de cada grupo. */
const PARTIDAS: Record<Grupo, [string, number][]> = {
  "La Mesa": [
    ["MECD-CC1-012", 500], // CABLE CAL 10 AWG THHW-LS VERDE   — en los 4
    ["CANAL-TCM-029", 40], //  TUBO CONDUIT METÁLICO 2"         — en los 4
    ["CANAL-CW2-018", 40], //  CONECTORES WP 2"                 — SOLO aquí
  ],
  "Planta Pilas": [
    ["MECD-CC1-012", 350],
    ["CANAL-TCM-029", 25],
    ["CANAL-CVS-012", 30], //  CINTA VULCANIZABLE SUPER 23      — Planta Pilas y Pringón
  ],
  "Pringón": [
    ["MECD-CC1-012", 420],
    ["CANAL-TCM-029", 30],
    ["CANAL-CVS-012", 24],
  ],
  "Yerba Buena 3": [
    ["MECD-CC1-012", 280],
    ["CANAL-TCM-029", 20],
  ],
};
const CODIGO_FLETE = "SP-FDE-001";

/** "YYYY-MM-DDTHH:mm" en hora de México (UTC-6 fija), lo que espera parsearFechaMexico. */
function fechaHoraMexico(d: Date): string {
  return new Date(d.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
/** Día calendario en México (AAAA-MM-DD). */
const diaMexico = (d: Date) => fechaHoraMexico(d).slice(0, 10);
const nfc = (s: string) => s.normalize("NFC");

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planearGrupos, formatearCoordenadas } = require("../src/lib/licitacionGrupos") as typeof import("../src/lib/licitacionGrupos");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMapaProveedorMateriales } = require("../src/lib/proveedorMaterialesData") as typeof import("../src/lib/proveedorMaterialesData");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { esAutollenable } = require("../src/lib/autollenadoPrecios") as typeof import("../src/lib/autollenadoPrecios");

  const problemas: string[] = [];

  const dueno = await prisma.usuario.findFirst({
    where: { email: { equals: CORREO_DUENO, mode: "insensitive" } },
    select: { id: true, nombre: true, activo: true },
  });
  if (!dueno || !dueno.activo) throw new Error(`El usuario dueño no existe o está inactivo.`);

  const existente = await prisma.licitacion.findUnique({ where: { numero: NUMERO }, select: { estado: true } });
  if (existente) {
    problemas.push(`Ya existe ${NUMERO} (${existente.estado}). Corre scripts/sql/prueba_grupos_limpieza.sql antes de recrearla.`);
  }

  // Tope de la limpieza: debe poder borrar todas las de prueba sin abortar.
  const dePrueba = await prisma.licitacion.findMany({
    where: { OR: [{ numero: { startsWith: "PRUEBA-GRUPOS" } }, { numero: { in: ["PRUEBA-AUTOLLENADO", NUMERO] } }] },
    select: { numero: true },
  });
  const TOPE_LIMPIEZA = 4;
  const trasCrear = dePrueba.length + (existente ? 0 : 1);
  if (trasCrear > TOPE_LIMPIEZA) {
    problemas.push(`Quedarían ${trasCrear} licitaciones de prueba y la limpieza aborta con más de ${TOPE_LIMPIEZA}.`);
  }

  // ── Grupos: los de la 0029 ────────────────────────────────────────────────
  const origen = await prisma.licitacion.findUnique({
    where: { numero: NUMERO_ORIGEN_GRUPOS },
    select: {
      grupos: {
        where: { eliminado: false },
        orderBy: { orden: "asc" },
        select: { nombre: true, domicilio: true, latitud: true, longitud: true },
      },
    },
  });
  if (!origen) throw new Error(`No existe la licitación ${NUMERO_ORIGEN_GRUPOS}.`);
  const grupos: GrupoInput[] = [];
  GRUPOS_0029.forEach((nombre, i) => {
    const g = origen.grupos.find((x) => nfc(x.nombre) === nfc(nombre));
    if (!g) {
      problemas.push(`La ${NUMERO_ORIGEN_GRUPOS} no tiene el grupo "${nombre}".`);
      return;
    }
    grupos.push({ clave: `g${i + 1}`, nombre: g.nombre, domicilio: g.domicilio ?? "", coordenadas: formatearCoordenadas(g.latitud, g.longitud) });
  });

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: PROVEEDOR_ID },
    select: { razonSocial: true, eliminado: true, usuario: { select: { activo: true } } },
  });
  if (!proveedor || proveedor.eliminado) problemas.push("Proveedor2 no existe o está eliminado.");
  const portalActivo = !!proveedor?.usuario?.activo;
  if (!portalActivo) problemas.push("Proveedor2 no tiene usuario activo del portal.");

  const catalogo = new Set((await getMapaProveedorMateriales())[PROVEEDOR_ID] ?? []);

  const codigos = [...new Set([...Object.values(PARTIDAS).flat().map(([c]) => c), CODIGO_FLETE])];
  const productos = await prisma.producto.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true, codigo: true, nombre: true, unidadMedida: true, familia: true, activo: true, eliminado: true },
  });
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  for (const c of codigos) {
    const p = porCodigo.get(c);
    if (!p) problemas.push(`No existe el producto ${c}`);
    else if (p.eliminado || !p.activo) problemas.push(`El producto ${c} está eliminado o inactivo`);
    else if (!catalogo.has(p.id)) problemas.push(`${c} no está en el catálogo de Proveedor2: no lo vería en el portal`);
  }

  // ── Fechas ────────────────────────────────────────────────────────────────
  const ahora = new Date();
  const inicio = new Date(ahora.getTime() + MINUTOS_PARA_INICIO * 60 * 1000);
  const fin = new Date(inicio.getTime() + MAX_RONDAS * DURACION_RONDA_MINUTOS * 60 * 1000);
  const entrega = FECHA_ENTREGA;
  if (entrega <= diaMexico(fin)) problemas.push(`La fecha requerida ${entrega} no queda después del cierre (${diaMexico(fin)}).`);

  // ── Partidas ──────────────────────────────────────────────────────────────
  const items: ItemInput[] = [];
  const filas: { grupo: string; codigo: string; cantidad: number }[] = [];
  GRUPOS_0029.forEach((nombre, i) => {
    for (const [codigo, cantidad] of [...PARTIDAS[nombre], [CODIGO_FLETE, 1] as [string, number]]) {
      filas.push({ grupo: nombre, codigo, cantidad });
      const p = porCodigo.get(codigo);
      if (!p) continue;
      items.push({
        productoId: p.id,
        unidadMedida: p.unidadMedida,
        especificacion: "",
        fechaEntrega: entrega,
        cantidadSolicitada: String(cantidad),
        precioObjetivo: "1",
        moneda: "MXN",
        grupoClave: `g${i + 1}`,
      });
    }
  });
  if (items.length !== TOTAL_ESPERADO) problemas.push(`Hay ${items.length} partidas; se esperaban ${TOTAL_ESPERADO}.`);

  const payload: LicitacionInput = {
    numero: NUMERO,
    jerarquia: "Alta",
    tipoLicitacion: "Made to Use",
    costoObjetivo: null,
    fechaEjecucion: fechaHoraMexico(inicio),
    fechaFinLicitacion: fechaHoraMexico(fin),
    fechaInicioRangoEntrega: entrega,
    fechaFinRangoEntrega: entrega,
    duracionRondaMinutos: DURACION_RONDA_MINUTOS,
    maxRondas: MAX_RONDAS,
    instrucciones: "DEMOSTRACIÓN — licitación de ejemplo para explicar cómo cotizar en el portal. No es una licitación real.",
    archivosAdjuntos: [],
    intencion: "guardar_borrador",
    modoLicitacion: "Proveedores",
    reordenado: false,
    items,
    grupos,
    proveedoresInvitados: [PROVEEDOR_ID],
    monedaConsolidacion: "MXN",
  };
  problemas.push(...planearGrupos([], grupos, items).errores.map((e) => `Grupos: ${e}`));

  // En cuántos grupos aparece cada código (para el reporte).
  const gruposPorCodigo = new Map<string, number>();
  for (const f of filas) gruposPorCodigo.set(f.codigo, (gruposPorCodigo.get(f.codigo) ?? 0) + 1);

  // ── Reporte ───────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}\n${linea}`);
  console.log(`Número      : ${NUMERO}`);
  console.log(`Dueño       : ${dueno.nombre}`);
  console.log(`Invitado    : ${proveedor?.razonSocial ?? "?"} (catálogo: ${catalogo.size} productos; portal: ${portalActivo ? "sí" : "NO"})`);
  console.log(`Inicio      : ${payload.fechaEjecucion} (México) — en ${MINUTOS_PARA_INICIO} min, contados desde que se corra --apply`);
  console.log(`Fin         : ${payload.fechaFinLicitacion} (México) = inicio + ${MAX_RONDAS} × 30 días`);
  console.log(`Rondas      : ${MAX_RONDAS} de ${DURACION_RONDA_MINUTOS} min (${DURACION_RONDA_MINUTOS / 1440} días)`);
  console.log(`Entrega     : ${entrega} en todas las partidas (rango ${entrega} → ${entrega})`);
  console.log(`Moneda      : MXN en todas · precio objetivo 1 en todas`);
  console.log(`Limpieza    : hoy hay ${dePrueba.length} de prueba (${dePrueba.map((l) => l.numero).join(", ") || "ninguna"}); quedarían ${trasCrear}, tope ${TOPE_LIMPIEZA}`);
  console.log(`\nPartidas (${items.length}):`);
  GRUPOS_0029.forEach((nombre, i) => {
    const g = grupos[i];
    console.log(`  ${i + 1}. ${nombre}`);
    console.log(`     ${g?.domicilio ?? "?"}`);
    console.log(`     ${g?.coordenadas || "(sin coordenadas)"}`);
    for (const f of filas.filter((x) => x.grupo === nombre)) {
      const p = porCodigo.get(f.codigo);
      const n = gruposPorCodigo.get(f.codigo) ?? 0;
      const nota = p && !esAutollenable(p.familia) ? "no se autollena" : n === 1 ? "solo en este grupo" : `autollena · en ${n} grupos`;
      console.log(
        `       · ${f.codigo.padEnd(14)} ${(p?.nombre ?? "?").slice(0, 34).padEnd(34)} ${String(f.cantidad).padStart(4)} ${(p?.unidadMedida ?? "").padEnd(8)} ${nota}`
      );
    }
  });
  if (problemas.length) console.log(`\n✗ Problemas:\n  · ${problemas.join("\n  · ")}`);

  instalarStubsServidor(dueno.id);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { crearLicitacionAction, lanzarLicitacionAction } = require("../src/lib/licitacionesActions") as typeof import("../src/lib/licitacionesActions");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { verificarYActualizarEstado } = require("../src/lib/licitacionesLogica") as typeof import("../src/lib/licitacionesLogica");
  verificarQueNoSeCargoLoReal();
  const correoCargado = () => Object.keys(require.cache).some((r) => /[\\/]src[\\/]lib[\\/]emailService\.ts$/.test(r));
  if (correoCargado()) problemas.push("Se cargó emailService: alguna acción podría mandar correo.");
  console.log(`\nAcciones cargadas con stubs de auth y next/cache: OK · módulo de correo cargado: ${correoCargado() ? "SÍ ✗" : "no"}`);

  if (problemas.length > 0) {
    console.log(`\n${linea}\nNO se puede aplicar: ${problemas.length} problema(s). No se escribió nada.\n${linea}\n`);
    await prisma.$disconnect();
    process.exitCode = APLICAR ? 1 : 0;
    return;
  }
  if (!APLICAR) {
    console.log(`\n${linea}\nTodo resuelve. Repite con --apply para crearla.\n${linea}\n`);
    await prisma.$disconnect();
    return;
  }
  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`\n¿Crear ${NUMERO}? Escribe CREAR para continuar: `);
    rl.close();
    if (r.trim().toUpperCase() !== "CREAR") {
      console.log("Cancelado. No se escribió nada.\n");
      await prisma.$disconnect();
      return;
    }
  }

  const creada = await crearLicitacionAction(BASE_PATH, payload);
  verificarQueNoSeCargoLoReal();
  if (!creada.ok) {
    console.log(`\n✗ La acción rechazó la licitación: ${creada.error}`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  const id = creada.licitacionId;
  console.log(`\n✓ 1/2 Creada en Borrador (${id}).`);

  const lanzada = await lanzarLicitacionAction(id, BASE_PATH);
  if (!lanzada.ok) {
    console.log(`✗ 2/2 No se pudo lanzar: ${lanzada.error}. Queda en Borrador; bórrala con la limpieza.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  // No-op mientras no llegue la hora de inicio; se deja por si el lanzamiento tardó.
  await verificarYActualizarEstado(id);
  if (correoCargado()) console.log(`⚠ Se cargó el módulo de correo durante la escritura. Revisar.`);

  const final = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      numero: true,
      estado: true,
      fechaEjecucion: true,
      grupos: { orderBy: { orden: "asc" }, select: { nombre: true, _count: { select: { items: true } } } },
      proveedoresInvitados: { select: { proveedor: { select: { razonSocial: true } } } },
      _count: { select: { items: true } },
    },
  });
  console.log(`✓ 2/2 ${final?.numero}: ${final?.estado}. Arranca ${final?.fechaEjecucion ? fechaHoraMexico(final.fechaEjecucion) : "?"} (México).`);
  console.log(`  Partidas: ${final?._count.items} · ${final?.grupos.map((g) => `${g.nombre}: ${g._count.items}`).join(" · ")}`);
  console.log(`  Invitados: ${final?.proveedoresInvitados.map((p) => p.proveedor.razonSocial).join(", ")}`);
  console.log(`  Pasa a En Proceso al abrirla (portal o comprador) después de esa hora.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
