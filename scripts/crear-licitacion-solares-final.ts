/**
 * Crea en Borrador la licitación de los 4 proyectos solares con la lista FINAL
 * de materiales: scripts/datos/partidas_FINAL_por_proyecto.csv (244 partidas)
 * + FLETE y SEGURO por grupo = 252 partidas. Reemplaza a la 0029, que NO se
 * toca: se borra a mano después de verificar la nueva.
 *
 * Correr (DESPUÉS de cargar los materiales nuevos):
 *   npx tsx scripts/cargar-materiales-electricos.ts --csv=scripts/datos/materiales_FINAL_cargar.csv --apply
 *   npx tsx scripts/crear-licitacion-solares-final.ts                → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/crear-licitacion-solares-final.ts --apply        → escribe (pide confirmación)
 *   npx tsx scripts/crear-licitacion-solares-final.ts --apply --yes  → escribe sin preguntar
 *
 * NO es idempotente: cada --apply crea OTRA licitación con el siguiente número.
 *
 * ── Cómo escribe ───────────────────────────────────────────────────────────
 * Igual que crear-licitacion-solares.ts: arma el payload del formulario y
 * llama a la acción real `crearLicitacionAction` con auth y next/cache
 * simulados (scripts/lib/stubsServidor.ts). No envía correos.
 *
 * ── Resolución de materiales ───────────────────────────────────────────────
 * Por scripts/datos/materiales_FINAL_cargar.csv (el cruce de los 106
 * materiales contra el catálogo):
 *   · con codigo_existente → el producto con ESE código;
 *   · sin él (material nuevo) → el producto con ese NOMBRE EXACTO, que crea
 *     la carga. En modo prueba, si todavía no existe, se cuenta como
 *     "pendiente de alta" y no bloquea; con --apply bloquea.
 * La unidad de la partida debe coincidir con la del producto (equivalencias
 * de nombre de catálogo y código viejo, p. ej. "Pieza" y "PZ"). Las 3 filas
 * con unidad FALTA en el Excel se toman como PZ, igual que en la carga.
 *
 * ── Reglas (decididas con el comprador, 2026-11-21) ────────────────────────
 * · Grupos: los 4 de la 0029, con su domicilio y coordenadas LEÍDOS de ella.
 *   Partidas en el orden del CSV; al final de cada grupo FLETE (SP-FDE-001) y
 *   SEGURO DE CARGA (SP-SDC-002), cantidad 1.
 * · Moneda MXN en TODAS (en la 0029 el CABLE FV CAL 10 quedó en USD).
 * · Precio objetivo 1 (pendiente de fondo: permitir vacío), especificación
 *   vacía, criticidad Alta, Made to Use, modo Proveedores, consolidación MXN.
 * · Fecha requerida 07/12/2026 en todas; rango de entrega 30/11 → 07/12.
 * · Vacíos, para el formulario: fechas de inicio y fin, instrucciones,
 *   proveedores invitados y costo objetivo. Rondas: 3 de 1440 min, como se
 *   creó la 0029 (el formulario las recalcula al poner las fechas).
 * · No se fusiona nada: cada material del CSV es su propia partida. Las 11
 *   filas REVISAR van como productos independientes y se marcan en el reporte.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { instalarStubsServidor, verificarQueNoSeCargoLoReal } from "./lib/stubsServidor";
import type { GrupoInput, ItemInput, LicitacionInput } from "../src/lib/licitacionInputTypes";

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const BASE_PATH = "/evolve-ba";

const CORREO_DUENO = "humberto.morales@evolveba.com.mx";
const NUMERO_ORIGEN_GRUPOS = "0029";
const ARCHIVO_PARTIDAS = "scripts/datos/partidas_FINAL_por_proyecto.csv";
const ARCHIVO_MATERIALES = "scripts/datos/materiales_FINAL_cargar.csv";

/** Proyecto del CSV = nombre del grupo en la 0029, en este orden. */
const PROYECTOS = ["La Mesa", "Planta Pilas", "Pringón", "Yerba Buena 3"];

const FECHA_REQUERIDA = "2026-12-07";
const RANGO_ENTREGA = { inicio: "2026-11-30", fin: "2026-12-07" };
const CODIGO_FLETE = "SP-FDE-001";
const CODIGO_SEGURO = "SP-SDC-002";
const PRECIO_OBJETIVO = "1";
const MONEDA = "MXN";
const DURACION_RONDA_MINUTOS = 1440;
const MAX_RONDAS = 3;
const PARTIDAS_CSV_ESPERADAS = 244;
const TOTAL_ESPERADO = PARTIDAS_CSV_ESPERADAS + PROYECTOS.length * 2; // 252

/** Unidad del CSV → unidades del producto que significan LO MISMO. */
const EQUIVALENCIAS_UNIDAD: Record<string, string[]> = {
  PZ: ["Pieza", "PZ"],
  M: ["Metro", "MTR"],
  TMO: ["Tramo", "TMO"],
  PAR: ["Par", "PAR"],
};

type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  activo: boolean;
  eliminado: boolean;
};

function leerCsv(ruta: string): Record<string, string>[] {
  const texto = readFileSync(resolve(ruta), "utf-8").replace(/^﻿/, "");
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      campo = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  }
  const [encabezado, ...resto] = filas;
  return resto.map((f) => Object.fromEntries(encabezado.map((h, i) => [h.trim(), (f[i] ?? "").trim()])));
}

const nfc = (s: string) => s.normalize("NFC");

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calcularSiguienteNumero } = require("../src/lib/numeroLicitacion") as typeof import("../src/lib/numeroLicitacion");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planearGrupos, formatearCoordenadas } = require("../src/lib/licitacionGrupos") as typeof import("../src/lib/licitacionGrupos");

  const problemas: string[] = [];

  const dueno = await prisma.usuario.findFirst({
    where: { email: { equals: CORREO_DUENO, mode: "insensitive" } },
    select: { id: true, nombre: true, activo: true, tipoUsuario: true },
  });
  if (!dueno || !dueno.activo) throw new Error(`El usuario dueño no existe o está inactivo.`);

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
  PROYECTOS.forEach((nombre, i) => {
    const g = origen.grupos.find((x) => nfc(x.nombre) === nfc(nombre));
    if (!g) problemas.push(`La ${NUMERO_ORIGEN_GRUPOS} no tiene el grupo "${nombre}".`);
    else if (!g.domicilio) problemas.push(`El grupo "${nombre}" de la ${NUMERO_ORIGEN_GRUPOS} no tiene domicilio.`);
    else grupos.push({ clave: `g${i + 1}`, nombre: g.nombre, domicilio: g.domicilio, coordenadas: formatearCoordenadas(g.latitud, g.longitud) });
  });

  // ── CSVs ──────────────────────────────────────────────────────────────────
  const partidasCsv = leerCsv(ARCHIVO_PARTIDAS);
  const materiales = leerCsv(ARCHIVO_MATERIALES);
  const materialPorNombre = new Map(materiales.map((m) => [nfc(m.nombre), m]));
  if (partidasCsv.length !== PARTIDAS_CSV_ESPERADAS) {
    problemas.push(`${ARCHIVO_PARTIDAS} trae ${partidasCsv.length} partidas; se esperaban ${PARTIDAS_CSV_ESPERADAS}.`);
  }
  for (const f of partidasCsv) {
    if (!PROYECTOS.some((p) => nfc(p) === nfc(f.proyecto))) problemas.push(`Proyecto "${f.proyecto}" no está en PROYECTOS.`);
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  const productos: Producto[] = await prisma.producto.findMany({
    select: { id: true, codigo: true, nombre: true, unidadMedida: true, activo: true, eliminado: true },
  });
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  const porNombre = new Map<string, Producto[]>();
  for (const p of productos) {
    if (p.eliminado) continue;
    const k = nfc(p.nombre);
    porNombre.set(k, [...(porNombre.get(k) ?? []), p]);
  }

  const pendientesDeAlta = new Set<string>(); // material nuevo que la carga aún no crea
  const resolver = (material: string, unidadCsv: string): Producto | "pendiente" | null => {
    const m = materialPorNombre.get(nfc(material));
    if (!m) {
      problemas.push(`${material}: no está en ${ARCHIVO_MATERIALES}`);
      return null;
    }
    let p: Producto | undefined;
    if (m.codigo_existente) {
      p = porCodigo.get(m.codigo_existente);
      if (!p) {
        problemas.push(`${material}: el código ${m.codigo_existente} no existe`);
        return null;
      }
    } else {
      const candidatos = porNombre.get(nfc(material)) ?? [];
      if (candidatos.length === 0) {
        pendientesDeAlta.add(material);
        return "pendiente";
      }
      if (candidatos.length > 1) {
        problemas.push(`${material}: ${candidatos.length} productos con ese nombre (${candidatos.map((c) => c.codigo).join(", ")})`);
        return null;
      }
      p = candidatos[0];
    }
    if (p.eliminado || !p.activo) {
      problemas.push(`${material}: el producto ${p.codigo} está ${p.eliminado ? "eliminado" : "inactivo"}`);
      return null;
    }
    const unidad = unidadCsv === "FALTA" ? "PZ" : unidadCsv.toUpperCase();
    const aceptadas = EQUIVALENCIAS_UNIDAD[unidad];
    if (!aceptadas || !aceptadas.includes(p.unidadMedida)) {
      problemas.push(`${material}: unidad ${unidadCsv} ≠ ${p.codigo} "${p.unidadMedida}"`);
    }
    return p;
  };

  const flete = porCodigo.get(CODIGO_FLETE);
  const seguro = porCodigo.get(CODIGO_SEGURO);
  for (const [cod, p] of [[CODIGO_FLETE, flete], [CODIGO_SEGURO, seguro]] as const) {
    if (!p || p.eliminado || !p.activo) problemas.push(`El producto ${cod} no existe o no está activo.`);
  }

  // ── Partidas ──────────────────────────────────────────────────────────────
  const items: ItemInput[] = [];
  const resumen: { proyecto: string; csv: number; pendientes: number; total: number }[] = [];
  const revisarEnLicitacion = new Map<string, string[]>(); // material REVISAR → proyectos
  const nueva = (productoId: string, unidadMedida: string, cantidad: number, clave: string): ItemInput => ({
    productoId,
    unidadMedida,
    especificacion: "",
    fechaEntrega: FECHA_REQUERIDA,
    cantidadSolicitada: String(cantidad),
    precioObjetivo: PRECIO_OBJETIVO,
    moneda: MONEDA,
    grupoClave: clave,
  });
  PROYECTOS.forEach((proyecto, i) => {
    const clave = `g${i + 1}`;
    const filas = partidasCsv.filter((f) => nfc(f.proyecto) === nfc(proyecto));
    const productosDelGrupo = new Map<string, string>();
    let pendientes = 0;
    for (const f of filas) {
      const cantidad = Number(f.cantidad);
      if (!(cantidad > 0)) problemas.push(`${proyecto} · ${f.material}: cantidad "${f.cantidad}" inválida`);
      const m = materialPorNombre.get(nfc(f.material));
      if (m?.revisar) revisarEnLicitacion.set(f.material, [...(revisarEnLicitacion.get(f.material) ?? []), proyecto]);
      const p = resolver(f.material, f.unidad);
      if (p === "pendiente") {
        pendientes++;
        // Marcador SOLO para el modo prueba (nunca llega a escribirse: con
        // pendientes, --apply se bloquea abajo).
        items.push(nueva(`(pendiente) ${f.material}`, f.unidad, cantidad, clave));
      } else if (p) {
        const previo = productosDelGrupo.get(p.id);
        if (previo) problemas.push(`${proyecto}: "${previo}" y "${f.material}" caen en el mismo producto ${p.codigo}`);
        productosDelGrupo.set(p.id, f.material);
        items.push(nueva(p.id, p.unidadMedida, cantidad, clave));
      }
    }
    if (flete) items.push(nueva(flete.id, flete.unidadMedida, 1, clave));
    if (seguro) items.push(nueva(seguro.id, seguro.unidadMedida, 1, clave));
    resumen.push({ proyecto, csv: filas.length, pendientes, total: filas.length + 2 });
  });

  // ── Licitación ────────────────────────────────────────────────────────────
  const numeros = await prisma.licitacion.findMany({ select: { numero: true } });
  const numero = calcularSiguienteNumero(numeros.map((l) => l.numero));
  const payload: LicitacionInput = {
    numero,
    jerarquia: "Alta",
    tipoLicitacion: "Made to Use",
    costoObjetivo: null,
    fechaEjecucion: null,
    fechaFinLicitacion: null,
    fechaInicioRangoEntrega: RANGO_ENTREGA.inicio,
    fechaFinRangoEntrega: RANGO_ENTREGA.fin,
    duracionRondaMinutos: DURACION_RONDA_MINUTOS,
    maxRondas: MAX_RONDAS,
    instrucciones: null,
    archivosAdjuntos: [],
    intencion: "guardar_borrador",
    modoLicitacion: "Proveedores",
    reordenado: false,
    items,
    grupos,
    proveedoresInvitados: [],
    monedaConsolidacion: "MXN",
  };
  problemas.push(...planearGrupos([], grupos, items).errores.map((e) => `Grupos: ${e}`));
  if (items.length !== TOTAL_ESPERADO) problemas.push(`Hay ${items.length} partidas; se esperaban ${TOTAL_ESPERADO}.`);

  // ── Reporte ───────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}\n${linea}`);
  console.log(`Número que se asignaría : ${numero}  (la ${NUMERO_ORIGEN_GRUPOS} no se toca)`);
  console.log(`Dueño                   : ${dueno.nombre} (${dueno.tipoUsuario})`);
  console.log(`Estado                  : Borrador · Proveedores · Alta · Made to Use · ${MAX_RONDAS} rondas de ${DURACION_RONDA_MINUTOS} min`);
  console.log(`Fecha requerida         : ${FECHA_REQUERIDA} en todas · rango de entrega ${RANGO_ENTREGA.inicio} → ${RANGO_ENTREGA.fin}`);
  console.log(`Moneda / precio objetivo: ${MONEDA} en todas / ${PRECIO_OBJETIVO} en todas · especificación vacía`);
  console.log(`Vacíos (formulario)     : inicio y fin, instrucciones, proveedores invitados, costo objetivo`);
  console.log(`\nGrupos:`);
  resumen.forEach((r, i) => {
    const g = grupos[i];
    console.log(`  ${i + 1}. ${r.proyecto.padEnd(14)} ${String(r.total).padStart(3)} partidas (${r.csv} del CSV + flete + seguro)${r.pendientes ? ` · ${r.pendientes} con material pendiente de alta` : ""}`);
    console.log(`     ${g?.domicilio ?? "?"}`);
    console.log(`     ${g?.coordenadas || "(sin coordenadas)"}`);
  });
  console.log(`\nTotal de partidas: ${items.length} (esperado ${TOTAL_ESPERADO})`);
  if (revisarEnLicitacion.size) {
    console.log(`\nMateriales REVISAR en la licitación (${revisarEnLicitacion.size}), cada uno como su propio producto:`);
    for (const [m, ps] of revisarEnLicitacion) {
      const fila = materialPorNombre.get(nfc(m));
      console.log(`  · ${m} — ${fila?.codigo_existente ? `existente ${fila.codigo_existente}` : "NUEVO"} — en ${ps.join(", ")}`);
    }
  }
  if (pendientesDeAlta.size) {
    console.log(`\nMateriales nuevos que aún no existen (${pendientesDeAlta.size}): los crea la carga; ${APLICAR ? "BLOQUEA el --apply" : "en modo prueba no bloquea"}.`);
  }
  if (problemas.length) console.log(`\n✗ Problemas:\n  · ${problemas.join("\n  · ")}`);

  instalarStubsServidor(dueno.id);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { crearLicitacionAction } = require("../src/lib/licitacionesActions") as typeof import("../src/lib/licitacionesActions");
  verificarQueNoSeCargoLoReal();
  console.log(`\nAcción crearLicitacionAction cargada con stubs de auth y next/cache: OK`);

  const bloqueos = problemas.length + (APLICAR ? pendientesDeAlta.size : 0);
  if (bloqueos > 0) {
    console.log(`\n${linea}\nNO se puede aplicar: ${bloqueos} bloqueo(s). No se escribió nada.\n${linea}\n`);
    await prisma.$disconnect();
    process.exitCode = APLICAR ? 1 : 0;
    return;
  }
  if (!APLICAR) {
    console.log(
      `\n${linea}\n${pendientesDeAlta.size ? "Resuelve todo salvo los materiales que crea la carga. " : "Todo resuelve. "}` +
        `Después de la carga, repite con --apply para crear la ${numero}.\n${linea}\n`
    );
    await prisma.$disconnect();
    return;
  }
  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`\n¿Crear la licitación ${numero} con ${items.length} partidas? Escribe CREAR para continuar: `);
    rl.close();
    if (r.trim().toUpperCase() !== "CREAR") {
      console.log("Cancelado. No se escribió nada.\n");
      await prisma.$disconnect();
      return;
    }
  }

  const resultado = await crearLicitacionAction(BASE_PATH, payload);
  verificarQueNoSeCargoLoReal();
  if (!resultado.ok) {
    console.log(`\n✗ La acción rechazó la licitación: ${resultado.error}`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }
  const creada = await prisma.licitacion.findUnique({
    where: { id: resultado.licitacionId },
    select: {
      numero: true,
      estado: true,
      grupos: { orderBy: { orden: "asc" }, select: { nombre: true, orden: true, _count: { select: { items: true } } } },
      _count: { select: { items: true } },
    },
  });
  const monedas = await prisma.licitacionItem.groupBy({
    by: ["moneda"],
    where: { licitacionId: resultado.licitacionId },
    _count: true,
  });
  console.log(`\n✓ Creada la licitación ${creada?.numero} (${resultado.licitacionId}) en ${creada?.estado}.`);
  console.log(`  Partidas en la base: ${creada?._count.items} · monedas: ${monedas.map((m) => `${m.moneda} ${m._count}`).join(", ")}`);
  for (const g of creada?.grupos ?? []) console.log(`  · ${g.orden}. ${g.nombre}: ${g._count.items}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
