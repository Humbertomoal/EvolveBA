/**
 * Crea en Borrador la licitación de los 4 proyectos solares, un grupo por
 * proyecto, a partir de scripts/datos/partidas_por_proyecto.csv.
 *
 * ⚠ YA APLICADO: el 2026-11-20 creó la licitación 0029 (244 partidas). NO es
 * idempotente: correrlo otra vez con --apply crearía OTRA licitación (0030)
 * con las mismas partidas. El modo prueba sí se puede correr sin riesgo.
 *
 * Correr:
 *   npx tsx scripts/crear-licitacion-solares.ts                → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/crear-licitacion-solares.ts --apply        → escribe (pide confirmación)
 *   npx tsx scripts/crear-licitacion-solares.ts --apply --yes  → escribe sin preguntar
 *
 * ── Cómo escribe ───────────────────────────────────────────────────────────
 * NO hace creates de Prisma: arma el payload que mandaría el formulario y llama
 * a la server action real `crearLicitacionAction`, con auth y next/cache
 * simulados (scripts/lib/stubsServidor.ts). Así hereda la creación de grupos,
 * la posición de las partidas, las validaciones de grupos, la transacción y la
 * bitácora. El NÚMERO no lo asigna la acción: lo calcula este script con
 * `calcularSiguienteNumero`, la misma función que la página "Nueva".
 *
 * ── Reglas (decididas con el comprador) ────────────────────────────────────
 * · Un grupo por proyecto, en el orden de PROYECTOS. Dentro de cada grupo, las
 *   partidas en el orden del CSV y al final FLETE (SP-FDE-001) y SEGURO DE
 *   CARGA (SP-SDC-002), con cantidad 1.
 * · Material repetido dentro de un proyecto (Pringón: CABLE CAL 250 KCMIL
 *   THHW-LS, 90 m + 100 m) → UNA partida con la suma, en el lugar de la primera.
 * · La columna `nota` NO se usa (incluye las 18 "Opcional"): especificación vacía.
 * · Precio objetivo = 1 en todas. NO es un precio: el formulario exige un
 *   valor y el análisis de ahorro divide entre él (0 truena). Pendiente de
 *   fondo: permitir dejarlo vacío.
 * · Moneda = monedaPredeterminada del producto, o MXN (igual que el formulario).
 * · Fecha requerida: una por proyecto (hoy, 07/12/2026 en los 4). Rango de
 *   entrega explícito en RANGO_ENTREGA (30/11 → 07/12); ver ahí por qué difieren.
 * · Quedan VACÍOS, para el formulario: fechas de inicio y fin de licitación,
 *   instrucciones y proveedores invitados.
 *
 * ── Resolución de materiales (si algo falla, NO escribe nada) ──────────────
 * Cada material se busca en scripts/datos/materiales_catalogo.csv por nombre:
 *   · con codigo_existente → el producto con ESE código (si trae varios
 *     códigos separados por "|", es ambiguo y se reporta);
 *   · sin codigo_existente → el producto con ese NOMBRE EXACTO (0 o más de 1
 *     coincidencias se reportan).
 * El producto debe estar activo y no eliminado.
 * La UNIDAD del CSV debe coincidir con la del producto. Se aceptan solo las
 * equivalencias de EQUIVALENCIAS_UNIDAD (el nombre del catálogo y el código
 * antiguo de la misma unidad, p. ej. "Pieza" y "PZ"). Cualquier otra cosa se
 * reporta: 20 metros no son 20 tramos.
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

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — llenar los valores marcados con "".
// ═════════════════════════════════════════════════════════════════════════════

/** Dueño de la licitación: el usuario con el que "se inicia sesión". */
const CORREO_DUENO = "humberto.morales@evolveba.com.mx";

/**
 * Un grupo por proyecto, en este orden. `proyecto` debe coincidir con la
 * columna del CSV. `fechaEntrega` en formato AAAA-MM-DD. `coordenadas` como
 * en el formulario ("20.853501, -104.486565") o "" si no hay.
 */
const PROYECTOS: {
  proyecto: string;
  clave: string;
  domicilio: string;
  coordenadas: string;
  fechaEntrega: string;
}[] = [
  {
    proyecto: "La Mesa",
    clave: "la-mesa",
    domicilio:
      "NAYARIT - PREDIO LA MESA S/N, PREDIO LA MESA, CIUDAD DEL VALLE, C.P. 63157, LA BARRANCA DEL ORO",
    coordenadas: "20.8535, -104.4865556",
    fechaEntrega: "2026-12-07",
  },
  {
    proyecto: "Planta Pilas",
    clave: "planta-pilas",
    domicilio:
      "GUANAJUATO - RANCHO LAS PILAS, CARRETERA A SAN CLEMENTE Y YAYYA A MANO IZQUIERDA, SAN CLEMENTE, C.P. 36213, ROMITA",
    coordenadas: "20.81625, -101.5246389",
    fechaEntrega: "2026-12-07",
  },
  {
    // El texto original decía "PRINGON SLP" / "SUBURBANO SAN LUIS DE", pero el
    // C.P. 37983 y las coordenadas son San Luis de la Paz, GUANAJUATO. Corregido
    // por el comprador para que nadie cotice flete a San Luis Potosí.
    proyecto: "Pringón",
    clave: "pringon",
    domicilio:
      "GUANAJUATO - GRANJA EL PRINGÓN, EL PRINGÓN, CIÉNEGA DEL REFUGIO, C.P. 37983, SAN LUIS DE LA PAZ",
    coordenadas: "21.1274167, -100.5271667",
    fechaEntrega: "2026-12-07",
  },
  {
    proyecto: "Yerba Buena 3",
    clave: "yerba-buena-3",
    domicilio:
      "NAYARIT - RANCHO LA YERBABUENA 3 S/N, PORCINA YERBABUENA, LA YERBABUENA, C.P. 63968, AMATLÁN DE CAÑAS",
    coordenadas: "20.7619167, -104.2735833",
    fechaEntrega: "2026-12-07",
  },
];

/**
 * Rango de entrega de la licitación (AAAA-MM-DD). Se fija aparte de la fecha
 * de las partidas a propósito: la preferencia es el 30/11 (va en las
 * instrucciones), pero la fecha REQUERIDA de cada partida es el 07/12, para que
 * "¿Cumples la fecha?" signifique algo. Con el 30, quien pudiera entregar el 3
 * diría "No" sin que haya un problema real. Cada fecha de partida debe caer
 * dentro de este rango.
 */
const RANGO_ENTREGA = { inicio: "2026-11-30", fin: "2026-12-07" };

const CODIGO_FLETE = "SP-FDE-001"; // FLETE DE ENTREGA DE MATERIAL
const CODIGO_SEGURO = "SP-SDC-002"; // SEGURO DE CARGA
const PRECIO_OBJETIVO = "1";
const JERARQUIA = "Alta";
const TIPO_LICITACION = "Made to Use";
const DURACION_RONDA_MINUTOS = 1440;
const MAX_RONDAS = 3;

/** Partidas esperadas: 236 del CSV (237 menos la fusión de Pringón) + 2 por grupo. */
const TOTAL_ESPERADO = 244;

/** Unidad del CSV → unidades del producto que significan LO MISMO. */
const EQUIVALENCIAS_UNIDAD: Record<string, string[]> = {
  PZ: ["Pieza", "PZ"],
  M: ["Metro", "MTR", "M"],
  TMO: ["Tramo", "TMO"],
  PAR: ["Par", "PAR"],
};

// ═════════════════════════════════════════════════════════════════════════════

type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  monedaPredeterminada: string | null;
  activo: boolean;
  eliminado: boolean;
};

/** CSV con comillas dobles (campos con comas y "" escapadas). */
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

function fechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

async function main() {
  // Lecturas con el MISMO cliente de Prisma que usa la acción.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { calcularSiguienteNumero } = require("../src/lib/numeroLicitacion") as typeof import("../src/lib/numeroLicitacion");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planearGrupos } = require("../src/lib/licitacionGrupos") as typeof import("../src/lib/licitacionGrupos");

  const problemas: string[] = [];
  const faltaConfig: string[] = [];

  // ── Dueño ─────────────────────────────────────────────────────────────────
  const dueno = await prisma.usuario.findFirst({
    where: { email: { equals: CORREO_DUENO, mode: "insensitive" } },
    select: { id: true, nombre: true, activo: true, tipoUsuario: true },
  });
  if (!dueno) throw new Error(`No existe el usuario ${CORREO_DUENO}.`);
  if (!dueno.activo) throw new Error(`El usuario ${CORREO_DUENO} está inactivo.`);

  // ── Configuración de proyectos ────────────────────────────────────────────
  for (const p of PROYECTOS) {
    if (!p.domicilio.trim()) faltaConfig.push(`${p.proyecto}: domicilio`);
    if (!p.fechaEntrega) faltaConfig.push(`${p.proyecto}: fecha de entrega`);
    else if (!fechaValida(p.fechaEntrega)) problemas.push(`${p.proyecto}: fecha "${p.fechaEntrega}" no es AAAA-MM-DD válida`);
    else if (p.fechaEntrega < RANGO_ENTREGA.inicio || p.fechaEntrega > RANGO_ENTREGA.fin) {
      problemas.push(`${p.proyecto}: fecha ${p.fechaEntrega} fuera del rango ${RANGO_ENTREGA.inicio} → ${RANGO_ENTREGA.fin}`);
    }
  }
  if (!fechaValida(RANGO_ENTREGA.inicio) || !fechaValida(RANGO_ENTREGA.fin) || RANGO_ENTREGA.inicio > RANGO_ENTREGA.fin) {
    problemas.push(`Rango de entrega inválido: ${RANGO_ENTREGA.inicio} → ${RANGO_ENTREGA.fin}`);
  }

  // ── CSVs ──────────────────────────────────────────────────────────────────
  const partidasCsv = leerCsv("scripts/datos/partidas_por_proyecto.csv");
  const catalogoCsv = leerCsv("scripts/datos/materiales_catalogo.csv");
  const catalogoPorNombre = new Map(catalogoCsv.map((c) => [nfc(c.nombre), c]));

  const proyectosConfig = new Set(PROYECTOS.map((p) => nfc(p.proyecto)));
  for (const f of partidasCsv) {
    if (!proyectosConfig.has(nfc(f.proyecto))) problemas.push(`Proyecto "${f.proyecto}" del CSV no está en PROYECTOS`);
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  const productos: Producto[] = await prisma.producto.findMany({
    select: { id: true, codigo: true, nombre: true, unidadMedida: true, monedaPredeterminada: true, activo: true, eliminado: true },
  });
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));
  const porNombre = new Map<string, Producto[]>();
  for (const p of productos) {
    if (p.eliminado) continue;
    const k = nfc(p.nombre);
    porNombre.set(k, [...(porNombre.get(k) ?? []), p]);
  }

  const noResueltos = new Map<string, string>(); // material → motivo
  const unidadesQueNoCoinciden = new Map<string, string>(); // material → detalle
  const porEquivalencia = new Map<string, string>(); // material → unidad vieja aceptada (informativo)
  const resolverMaterial = (material: string, unidadCsv: string): Producto | null => {
    const fila = catalogoPorNombre.get(nfc(material));
    let producto: Producto | null = null;
    if (!fila) {
      noResueltos.set(material, "no está en materiales_catalogo.csv");
      return null;
    }
    const codigos = fila.codigo_existente.split("|").map((c) => c.trim()).filter(Boolean);
    if (codigos.length > 1) {
      noResueltos.set(material, `codigo_existente ambiguo: ${codigos.join(" | ")}`);
      return null;
    }
    if (codigos.length === 1) {
      producto = porCodigo.get(codigos[0]) ?? null;
      if (!producto) {
        noResueltos.set(material, `el código ${codigos[0]} no existe en la base`);
        return null;
      }
    } else {
      const candidatos = porNombre.get(nfc(material)) ?? [];
      if (candidatos.length !== 1) {
        noResueltos.set(
          material,
          candidatos.length === 0
            ? "no hay producto con ese nombre exacto"
            : `${candidatos.length} productos con ese nombre: ${candidatos.map((c) => c.codigo).join(", ")}`
        );
        return null;
      }
      producto = candidatos[0];
    }
    if (producto.eliminado || !producto.activo) {
      noResueltos.set(material, `el producto ${producto.codigo} está ${producto.eliminado ? "eliminado" : "inactivo"}`);
      return null;
    }
    const aceptadas = EQUIVALENCIAS_UNIDAD[unidadCsv.toUpperCase()];
    if (!aceptadas) {
      unidadesQueNoCoinciden.set(material, `unidad del CSV "${unidadCsv}" desconocida`);
    } else if (!aceptadas.includes(producto.unidadMedida)) {
      unidadesQueNoCoinciden.set(
        material,
        `CSV ${unidadCsv} ≠ producto ${producto.codigo} "${producto.unidadMedida || "(vacía)"}"`
      );
    } else if (producto.unidadMedida !== aceptadas[0]) {
      porEquivalencia.set(material, `${unidadCsv} ↔ ${producto.codigo} "${producto.unidadMedida}"`);
    }
    return producto;
  };

  const flete = porCodigo.get(CODIGO_FLETE);
  const seguro = porCodigo.get(CODIGO_SEGURO);
  for (const [cod, p] of [[CODIGO_FLETE, flete], [CODIGO_SEGURO, seguro]] as const) {
    if (!p) problemas.push(`No existe el producto ${cod}`);
    else if (p.eliminado || !p.activo) problemas.push(`El producto ${cod} está eliminado o inactivo`);
  }

  // ── Partidas por proyecto ─────────────────────────────────────────────────
  const fusiones: string[] = [];
  const items: ItemInput[] = [];
  const resumenGrupos: { proyecto: string; csv: number; total: number }[] = [];
  const nuevaPartida = (p: Producto, cantidad: number, clave: string, fecha: string): ItemInput => ({
    productoId: p.id,
    unidadMedida: p.unidadMedida,
    especificacion: "",
    fechaEntrega: fecha,
    cantidadSolicitada: String(cantidad),
    precioObjetivo: PRECIO_OBJETIVO,
    moneda: p.monedaPredeterminada || "MXN",
    grupoClave: clave,
  });

  for (const proy of PROYECTOS) {
    const filas = partidasCsv.filter((f) => nfc(f.proyecto) === nfc(proy.proyecto));
    // Fusión de materiales repetidos dentro del proyecto, en el lugar del primero.
    const acumulado = new Map<string, { material: string; unidad: string; cantidad: number; partes: number[] }>();
    for (const f of filas) {
      const cantidad = Number(f.cantidad);
      if (!(cantidad > 0)) {
        problemas.push(`${proy.proyecto} · ${f.material}: cantidad "${f.cantidad}" inválida`);
        continue;
      }
      const k = nfc(f.material);
      const previo = acumulado.get(k);
      if (previo) {
        if (previo.unidad !== f.unidad) {
          problemas.push(`${proy.proyecto} · ${f.material}: repetido con unidades distintas (${previo.unidad} y ${f.unidad})`);
        }
        previo.cantidad += cantidad;
        previo.partes.push(cantidad);
      } else {
        acumulado.set(k, { material: f.material, unidad: f.unidad, cantidad, partes: [cantidad] });
      }
    }
    let delGrupo = 0;
    for (const a of acumulado.values()) {
      if (a.partes.length > 1) {
        fusiones.push(`${proy.proyecto} · ${a.material}: ${a.partes.join(" + ")} = ${a.cantidad} ${a.unidad}`);
      }
      const producto = resolverMaterial(a.material, a.unidad);
      if (producto) {
        items.push(nuevaPartida(producto, a.cantidad, proy.clave, proy.fechaEntrega));
        delGrupo++;
      }
    }
    const csvDelGrupo = delGrupo;
    if (flete) items.push(nuevaPartida(flete, 1, proy.clave, proy.fechaEntrega));
    if (seguro) items.push(nuevaPartida(seguro, 1, proy.clave, proy.fechaEntrega));
    resumenGrupos.push({ proyecto: proy.proyecto, csv: csvDelGrupo, total: csvDelGrupo + (flete ? 1 : 0) + (seguro ? 1 : 0) });
  }

  // ── Licitación ────────────────────────────────────────────────────────────
  const numeros = await prisma.licitacion.findMany({ select: { numero: true } });
  const numero = calcularSiguienteNumero(numeros.map((l) => l.numero));
  const grupos: GrupoInput[] = PROYECTOS.map((p) => ({
    clave: p.clave,
    nombre: p.proyecto,
    domicilio: p.domicilio,
    coordenadas: p.coordenadas,
  }));
  const payload: LicitacionInput = {
    numero,
    jerarquia: JERARQUIA,
    tipoLicitacion: TIPO_LICITACION,
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

  // Misma validación de grupos que hará el servidor (pura).
  const erroresGrupos = planearGrupos([], grupos, items).errores;

  // ── Reporte ───────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}\n${linea}`);
  console.log(`Número que se asignaría : ${numero}`);
  console.log(`Dueño                   : ${dueno.nombre} <${CORREO_DUENO}> (${dueno.tipoUsuario})`);
  console.log(`Estado                  : Borrador · Proveedores · ${JERARQUIA} · ${TIPO_LICITACION} · ${MAX_RONDAS} rondas de ${DURACION_RONDA_MINUTOS} min`);
  console.log(`Rango de entrega        : ${payload.fechaInicioRangoEntrega ?? "FALTA"} → ${payload.fechaFinRangoEntrega ?? "FALTA"}`);
  console.log(`Vacíos (formulario)     : inicio/fin de licitación, instrucciones, proveedores invitados`);
  console.log(`\nGrupos:`);
  for (const [i, r] of resumenGrupos.entries()) {
    const p = PROYECTOS[i];
    console.log(
      `  ${String(i + 1)}. ${r.proyecto.padEnd(15)} ${String(r.total).padStart(3)} partidas (${r.csv} del CSV + flete + seguro)` +
        `  · entrega ${p.fechaEntrega || "FALTA"} · domicilio ${p.domicilio ? `"${p.domicilio}"` : "FALTA"}` +
        (p.coordenadas ? ` · ${p.coordenadas}` : "")
    );
  }
  console.log(`\nTotal de partidas: ${items.length} (esperado ${TOTAL_ESPERADO})`);
  if (fusiones.length) console.log(`\nFusionadas:\n  ${fusiones.join("\n  ")}`);

  if (noResueltos.size) {
    console.log(`\n✗ Materiales que NO se resolvieron (${noResueltos.size}):`);
    for (const [m, motivo] of noResueltos) console.log(`  · ${m} — ${motivo}`);
  }
  if (unidadesQueNoCoinciden.size) {
    console.log(`\n✗ Unidad que NO coincide (${unidadesQueNoCoinciden.size}):`);
    for (const [m, det] of unidadesQueNoCoinciden) console.log(`  · ${m} — ${det}`);
  }
  if (porEquivalencia.size) {
    console.log(`\nUnidad aceptada por equivalencia con el código viejo del producto (${porEquivalencia.size}, informativo):`);
    for (const [m, det] of porEquivalencia) console.log(`  · ${m} — ${det}`);
  }
  if (problemas.length) console.log(`\n✗ Otros problemas:\n  · ${problemas.join("\n  · ")}`);
  if (faltaConfig.length) console.log(`\n✗ Falta en la configuración (PROYECTOS):\n  · ${faltaConfig.join("\n  · ")}`);
  // Con domicilios pendientes, la validación de grupos solo repetiría "falta domicilio".
  if (faltaConfig.length === 0 && erroresGrupos.length) {
    console.log(`\n✗ Validación de grupos del servidor:\n  · ${erroresGrupos.join("\n  · ")}`);
  }

  const totalCuadra = items.length === TOTAL_ESPERADO;
  if (!totalCuadra && noResueltos.size === 0) console.log(`\n✗ El total no cuadra con ${TOTAL_ESPERADO}.`);

  const bloqueos =
    noResueltos.size + unidadesQueNoCoinciden.size + problemas.length + faltaConfig.length + erroresGrupos.length + (totalCuadra ? 0 : 1);

  // Carga la acción con los stubs también en modo prueba: confirma que el grafo
  // de módulos se resuelve sin la sesión ni la caché reales.
  instalarStubsServidor(dueno.id);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { crearLicitacionAction } = require("../src/lib/licitacionesActions") as typeof import("../src/lib/licitacionesActions");
  verificarQueNoSeCargoLoReal();
  console.log(`\nAcción crearLicitacionAction cargada con stubs de auth y next/cache: OK`);

  if (bloqueos > 0) {
    console.log(`\n${linea}\nNO se puede aplicar: ${bloqueos} bloqueo(s) arriba. No se escribió nada.\n${linea}\n`);
    await prisma.$disconnect();
    process.exitCode = APLICAR ? 1 : 0;
    return;
  }
  if (!APLICAR) {
    console.log(`\n${linea}\nTodo resuelve. Repite con --apply para crear la licitación ${numero}.\n${linea}\n`);
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

  // Relectura: lo que quedó en la base.
  const creada = await prisma.licitacion.findUnique({
    where: { id: resultado.licitacionId },
    select: {
      numero: true,
      estado: true,
      compradorId: true,
      grupos: { orderBy: { orden: "asc" }, select: { nombre: true, orden: true, _count: { select: { items: true } } } },
      _count: { select: { items: true } },
    },
  });
  console.log(`\n✓ Creada la licitación ${creada?.numero} (${resultado.licitacionId}) en ${creada?.estado}.`);
  console.log(`  Partidas en la base: ${creada?._count.items}`);
  for (const g of creada?.grupos ?? []) console.log(`  · ${g.orden}. ${g.nombre}: ${g._count.items}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
