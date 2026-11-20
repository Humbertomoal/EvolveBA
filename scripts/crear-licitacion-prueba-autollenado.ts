/**
 * Crea la licitación PRUEBA-AUTOLLENADO, ya En Proceso, para probar en el
 * portal del proveedor el autollenado de precios (src/lib/autollenadoPrecios.ts)
 * sin lanzar una licitación real.
 *
 * Correr:
 *   npx tsx scripts/crear-licitacion-prueba-autollenado.ts                → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/crear-licitacion-prueba-autollenado.ts --apply        → escribe (pide confirmación)
 *   npx tsx scripts/crear-licitacion-prueba-autollenado.ts --apply --yes  → escribe sin preguntar
 *
 * Se borra con scripts/sql/prueba_grupos_limpieza.sql (lo corre el usuario).
 * NO es repetible: si PRUEBA-AUTOLLENADO ya existe, aborta sin escribir; hay que
 * correr la limpieza antes de volver a crearla.
 *
 * ── Qué crea ───────────────────────────────────────────────────────────────
 * 2 grupos con domicilio ("PRUEBA Norte", "PRUEBA Sur"), 11 partidas:
 *   · 3 materiales en los dos grupos, en MXN          → el caso de autollenado
 *   · 1 material en los dos grupos, MXN en Norte y USD en Sur → no debe copiar
 *   · 1 material solo en Norte                        → no tiene a dónde copiar
 *   · FLETE (SP-FDE-001) en cada grupo                → no debe copiar
 * Invitado SOLO Proveedor2. Todos los materiales deben estar en su catálogo (si
 * no, no los vería en el portal): si falta alguno, NO escribe.
 *
 * ── Cómo escribe (sin mandar correos) ──────────────────────────────────────
 * Llama a las acciones reales, con auth y next/cache simulados
 * (scripts/lib/stubsServidor.ts), igual que crear-licitacion-solares.ts:
 *   1. crearLicitacionAction  → Borrador, con grupos, partidas e invitado.
 *   2. lanzarLicitacionAction → Programada. Esta acción NO envía correos: los
 *      manda el modal del navegador ANTES de llamarla. Aquí no hay modal, así
 *      que no sale ningún correo. Sí sella invitacionesEnviadasEn (es lo que
 *      hace la acción); en una licitación de prueba no importa.
 *   3. verificarYActualizarEstado → En Proceso, ronda 1, porque la fecha de
 *      inicio ya pasó. Publica el aviso "ronda 1" en el CHAT del portal de
 *      Proveedor2 (no es correo).
 *
 * Fechas: inicio = hace 2 minutos; fin y ronda = 7 días; 3 rondas. Así queda
 * En Proceso de inmediato y la ronda 1 dura una semana.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { instalarStubsServidor, verificarQueNoSeCargoLoReal } from "./lib/stubsServidor";
import type { GrupoInput, ItemInput, LicitacionInput } from "../src/lib/licitacionInputTypes";

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const BASE_PATH = "/evolve-ba";

const NUMERO = "PRUEBA-AUTOLLENADO";
const CORREO_DUENO = "humberto.morales@evolveba.com.mx";
const PROVEEDOR_ID = "cmscfvbu3000104l95apfjnv5"; // Proveedor2 (cuenta de prueba; su correo es del comprador)

const DURACION_RONDA_MINUTOS = 7 * 24 * 60;
const MAX_RONDAS = 3;
const DIAS_FIN = 7;

const GRUPOS: GrupoInput[] = [
  { clave: "norte", nombre: "PRUEBA Norte", domicilio: "PRUEBA — Domicilio Norte, C.P. 00000", coordenadas: "" },
  { clave: "sur", nombre: "PRUEBA Sur", domicilio: "PRUEBA — Domicilio Sur, C.P. 00000", coordenadas: "" },
];

/** Partidas en orden de pantalla: [código, grupo, cantidad, moneda]. */
const PARTIDAS: [string, "norte" | "sur", number, "MXN" | "USD"][] = [
  ["MECA-CC4-010", "norte", 100, "MXN"], // CABLE CAL 4 AWG VERDE              — en los dos
  ["MECD-CC1-012", "norte", 250, "MXN"], // CABLE CAL 10 AWG THHW-LS VERDE     — en los dos
  ["MECA-IT3-015", "norte", 2, "MXN"], //   INTERRUPTOR TERMOMAGNÉTICO 3X225 A — en los dos
  ["CONSUM-TN-001", "norte", 20, "MXN"], // TAPE NEGRO — MXN aquí, USD en Sur
  ["CHAROLA-TRD-002", "norte", 12, "MXN"], // TRAMO RECTO DE CHAROLA 6"     — solo Norte
  ["SP-FDE-001", "norte", 1, "MXN"], //     FLETE
  ["MECA-CC4-010", "sur", 60, "MXN"],
  ["MECD-CC1-012", "sur", 180, "MXN"],
  ["MECA-IT3-015", "sur", 1, "MXN"],
  ["CONSUM-TN-001", "sur", 15, "USD"],
  ["SP-FDE-001", "sur", 1, "MXN"],
];

/** "YYYY-MM-DDTHH:mm" en hora de México (UTC-6 fija), lo que espera parsearFechaMexico. */
function fechaHoraMexico(d: Date): string {
  return new Date(d.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
const soloDia = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planearGrupos } = require("../src/lib/licitacionGrupos") as typeof import("../src/lib/licitacionGrupos");
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

  const existente = await prisma.licitacion.findUnique({ where: { numero: NUMERO }, select: { id: true, estado: true } });
  if (existente) {
    problemas.push(`Ya existe ${NUMERO} (${existente.estado}). Corre scripts/sql/prueba_grupos_limpieza.sql antes de recrearla.`);
  }

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: PROVEEDOR_ID },
    select: { razonSocial: true, eliminado: true, usuario: { select: { activo: true } } },
  });
  if (!proveedor || proveedor.eliminado) problemas.push("Proveedor2 no existe o está eliminado.");
  const usuarioPortal = proveedor?.usuario?.activo ? 1 : 0;
  if (usuarioPortal === 0) problemas.push("Proveedor2 no tiene usuario activo del portal.");

  // Catálogo con la MISMA lectura que usa el portal.
  const catalogo = new Set((await getMapaProveedorMateriales())[PROVEEDOR_ID] ?? []);

  const codigos = [...new Set(PARTIDAS.map(([c]) => c))];
  const productos = await prisma.producto.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true, codigo: true, nombre: true, unidadMedida: true, familia: true, activo: true, eliminado: true },
  });
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  for (const c of codigos) {
    const p = porCodigo.get(c);
    if (!p) problemas.push(`No existe el producto ${c}`);
    else if (p.eliminado || !p.activo) problemas.push(`El producto ${c} está eliminado o inactivo`);
    else if (catalogo.size > 0 && !catalogo.has(p.id)) problemas.push(`${c} no está en el catálogo de Proveedor2: no lo vería en el portal`);
  }

  // ── Fechas ────────────────────────────────────────────────────────────────
  const ahora = new Date();
  const inicio = new Date(ahora.getTime() - 2 * 60 * 1000);
  const fin = new Date(ahora.getTime() + DIAS_FIN * 24 * 60 * 60 * 1000);
  const entrega = soloDia(new Date(ahora.getTime() + 14 * 24 * 60 * 60 * 1000));
  const rango = { inicio: soloDia(new Date(ahora.getTime() + 10 * 24 * 60 * 60 * 1000)), fin: entrega };

  const items: ItemInput[] = [];
  for (const [codigo, grupo, cantidad, moneda] of PARTIDAS) {
    const p = porCodigo.get(codigo);
    if (!p) continue;
    items.push({
      productoId: p.id,
      unidadMedida: p.unidadMedida,
      especificacion: "",
      fechaEntrega: entrega,
      cantidadSolicitada: String(cantidad),
      precioObjetivo: "1",
      moneda,
      grupoClave: grupo,
    });
  }
  const grupos = GRUPOS;

  const payload: LicitacionInput = {
    numero: NUMERO,
    jerarquia: "Alta",
    tipoLicitacion: "Made to Use",
    costoObjetivo: null,
    fechaEjecucion: fechaHoraMexico(inicio),
    fechaFinLicitacion: fechaHoraMexico(fin),
    fechaInicioRangoEntrega: rango.inicio,
    fechaFinRangoEntrega: rango.fin,
    duracionRondaMinutos: DURACION_RONDA_MINUTOS,
    maxRondas: MAX_RONDAS,
    instrucciones: "PRUEBA del autollenado de precios. No es una licitación real.",
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

  // ── Reporte ───────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}\n${linea}`);
  console.log(`Número      : ${NUMERO}`);
  console.log(`Dueño       : ${dueno.nombre}`);
  console.log(`Invitado    : ${proveedor?.razonSocial ?? "?"} (catálogo: ${catalogo.size} productos; usuario de portal: ${usuarioPortal > 0 ? "sí" : "NO"})`);
  console.log(`Inicio      : ${payload.fechaEjecucion} (México) — ya pasó: arranca En Proceso`);
  console.log(`Fin         : ${payload.fechaFinLicitacion} (México)`);
  console.log(`Rondas      : ${MAX_RONDAS} de ${DURACION_RONDA_MINUTOS} min (${DURACION_RONDA_MINUTOS / 1440} días)`);
  console.log(`Entrega     : ${entrega} (rango ${rango.inicio} → ${rango.fin})`);
  console.log(`Correos     : ninguno (ver cabecera del script)`);
  console.log(`\nPartidas (${items.length}):`);
  for (const g of GRUPOS) {
    console.log(`  ${g.nombre} — ${g.domicilio}`);
    for (const [codigo, grupo, cantidad, moneda] of PARTIDAS) {
      if (grupo !== g.clave) continue;
      const p = porCodigo.get(codigo);
      const auto = p && !esAutollenable(p.familia) ? "  [no se autollena]" : "";
      console.log(`    · ${codigo.padEnd(16)} ${(p?.nombre ?? "?").slice(0, 44).padEnd(44)} ${String(cantidad).padStart(4)} ${(p?.unidadMedida ?? "").padEnd(6)} ${moneda}${auto}`);
    }
  }
  if (problemas.length) console.log(`\n✗ Problemas:\n  · ${problemas.join("\n  · ")}`);

  instalarStubsServidor(dueno.id);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { crearLicitacionAction, lanzarLicitacionAction } = require("../src/lib/licitacionesActions") as typeof import("../src/lib/licitacionesActions");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { verificarYActualizarEstado } = require("../src/lib/licitacionesLogica") as typeof import("../src/lib/licitacionesLogica");
  verificarQueNoSeCargoLoReal();
  console.log(`\nAcciones cargadas con stubs de auth y next/cache: OK`);

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
    const r = await rl.question(`\n¿Crear ${NUMERO} y dejarla En Proceso? Escribe CREAR para continuar: `);
    rl.close();
    if (r.trim().toUpperCase() !== "CREAR") {
      console.log("Cancelado. No se escribió nada.\n");
      await prisma.$disconnect();
      return;
    }
  }

  // 1. Crear (Borrador).
  const creada = await crearLicitacionAction(BASE_PATH, payload);
  verificarQueNoSeCargoLoReal();
  if (!creada.ok) {
    console.log(`\n✗ La acción rechazó la licitación: ${creada.error}`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  const id = creada.licitacionId;
  console.log(`\n✓ 1/3 Creada en Borrador (${id}).`);

  // 2. Lanzar (Programada). Sin correos: ver cabecera.
  const lanzada = await lanzarLicitacionAction(id, BASE_PATH);
  if (!lanzada.ok) {
    console.log(`✗ 2/3 No se pudo lanzar: ${lanzada.error}. Queda en Borrador; bórrala con la limpieza.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  console.log(`✓ 2/3 Lanzada: ${lanzada.estado}.`);

  // 3. Arranque por reloj (En Proceso, ronda 1).
  await verificarYActualizarEstado(id);

  const final = await prisma.licitacion.findUnique({
    where: { id },
    select: {
      numero: true,
      estado: true,
      rondaActual: true,
      inicioRondaActual: true,
      grupos: { orderBy: { orden: "asc" }, select: { nombre: true, _count: { select: { items: true } } } },
      proveedoresInvitados: { select: { proveedor: { select: { razonSocial: true } } } },
      _count: { select: { items: true } },
    },
  });
  console.log(`✓ 3/3 ${final?.numero}: ${final?.estado}, ronda ${final?.rondaActual}, iniciada ${final?.inicioRondaActual?.toISOString()}.`);
  console.log(`  Partidas: ${final?._count.items} · ${final?.grupos.map((g) => `${g.nombre}: ${g._count.items}`).join(" · ")}`);
  console.log(`  Invitados: ${final?.proveedoresInvitados.map((p) => p.proveedor.razonSocial).join(", ")}`);
  if (final?.estado !== "En Proceso") {
    console.log(`  ⚠ No quedó En Proceso. Abrirla en el portal la arranca (la fecha de inicio ya pasó).`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
