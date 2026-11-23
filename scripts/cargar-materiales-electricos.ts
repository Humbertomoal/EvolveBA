/**
 * Carga de materiales eléctricos al catálogo de productos desde
 * scripts/datos/materiales_catalogo.csv.
 *
 * Correr:
 *   npx tsx scripts/cargar-materiales-electricos.ts                → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/cargar-materiales-electricos.ts --apply        → escribe (pide confirmación)
 *   npx tsx scripts/cargar-materiales-electricos.ts --apply --yes  → escribe sin preguntar
 *   --csv=<ruta>  para usar otro archivo (default: scripts/datos/materiales_catalogo.csv)
 *
 * ── Columnas del CSV ────────────────────────────────────────────────────────
 *   nombre, unidad (PZ|M|TMO|PAR), subfamilia, revisar, duda, codigo_existente, familia
 *   · revisar, duda, subfamilia: notas, no se escriben en la base.
 *   · codigo_existente: si trae código(s) (separados por "|"), la fila es un
 *     producto que YA existe y se omite. Cada código debe existir en la base.
 *   · familia: nombre EXACTO de la familia del catálogo con que se da de alta.
 *
 * ── Garantías ──────────────────────────────────────────────────────────────
 * · SOLO crea. No hay update/delete sobre productos existentes. En el catálogo
 *   (CatalogoValor) hace upsert con `update: {}` — igual que catalogosSeed.ts —
 *   así que un valor que ya exista no se modifica.
 * · IDEMPOTENTE: una fila se omite si trae codigo_existente o si su nombre
 *   normalizado (mayúsculas, sin acentos, comillas y espacios unificados) ya
 *   existe en la base, en cualquier estado. Correrlo dos veces no duplica.
 * · Si alguna fila no pasa la validación (unidad o familia desconocida, código
 *   inexistente, nombre repetido en el CSV), NO escribe nada, ni con --apply.
 * · Código: {CODIGO_CATALOGO_FAMILIA}-{INICIALES_NOMBRE}-{NNN}, p. ej.
 *   MECA-CAC-006. A DIFERENCIA del formulario, el prefijo es el código de la
 *   familia en CatalogoValor (MECA, MECD, CANAL, CONSUM, TIERRAS…), no las
 *   iniciales de su nombre: con iniciales, CA y CD comparten "MED". Así quedan
 *   como los productos existentes. Las iniciales del nombre y el consecutivo
 *   (máximo por familia + 1, saltando códigos ocupados) son los mismos de
 *   src/lib/generarCodigoProducto.ts. Se calcula en memoria para que dos filas
 *   de la misma corrida no choquen.
 *   PENDIENTE: que generarCodigoProducto.ts use también el código de catálogo,
 *   o el formulario seguirá generando MED-.
 * · Todo en UNA transacción (catálogo + productos): o queda todo o nada. El
 *   @unique de Producto.codigo detiene la carga si alguien creó el mismo código
 *   entre la lectura y la escritura.
 * · CATÁLOGO DE PROVEEDORES: cada producto creado se asigna (ProveedorMaterial)
 *   a los proveedores que ya tienen su familia asignada, en la misma
 *   transacción y con la misma regla que crearProducto
 *   (src/lib/catalogoPorFamilia.ts). Sin esto, los productos nacían fuera del
 *   catálogo de todos y el portal no se los mostraba a quien los surte.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from ".prisma/client/default";
import { familiasAsignadasPorProveedor, filasCatalogoPorFamilia } from "../src/lib/catalogoPorFamilia";
import {
  extraerConsecutivo,
  formatearConsecutivo,
  inicialesDescripcion,
} from "../src/lib/generarCodigoProducto";
import { PROVEEDORES_EXCLUIDOS } from "./lib/proveedoresExcluidos";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const ARCHIVO = resolve(
  process.argv.find((a) => a.startsWith("--csv="))?.slice("--csv=".length) ??
    "scripts/datos/materiales_catalogo.csv"
);

// Evolve BA. Toda la base usa este clienteId (ver crearProducto en src/lib/productos.ts).
const CLIENTE_ID = "default";

/** Unidad del CSV → NOMBRE del catálogo UNIDAD_MEDIDA (lo que guarda el formulario). */
const UNIDADES: Record<string, string> = {
  PZ: "Pieza",
  M: "Metro",
  TMO: "Tramo",
  PAR: "Par",
};

/** Valores de catálogo que esta carga necesita y que se dan de alta si faltan. */
const CATALOGO_REQUERIDO = [
  { tipo: "UNIDAD_MEDIDA", codigo: "TMO", nombre: "Tramo" },
  { tipo: "UNIDAD_MEDIDA", codigo: "PAR", nombre: "Par" },
  { tipo: "FAMILIA", codigo: "TIERRAS", nombre: "Sistema de Tierras" },
] as const;

const COLUMNAS = ["nombre", "unidad", "subfamilia", "codigo_existente", "familia"] as const;

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC 4180: comillas dobles, "" como comilla escapada, CRLF o LF, BOM opcional. */
function parsearCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Llave de comparación de nombres: la misma normalización que se usó en el cruce. */
function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toUpperCase()
    .replace(/[“”″]/g, '"')
    .replace(/''/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Plan ─────────────────────────────────────────────────────────────────────

type FilaCsv = {
  linea: number; // línea del archivo (1 = encabezado)
  nombre: string;
  unidad: string;
  familia: string;
  codigoExistente: string[];
};

type AltaCatalogo = { tipo: string; codigo: string; nombre: string; orden: number };
type Alta = {
  linea: number;
  codigo: string;
  nombre: string;
  familia: string;
  unidadMedida: string;
};
type Omitida = { linea: number; nombre: string; motivo: string };
type Rechazada = { linea: number; nombre: string; motivo: string };

function leerFilas(): FilaCsv[] {
  const filas = parsearCsv(readFileSync(ARCHIVO, "utf8"));
  const encabezado = filas.shift()?.map((h) => h.trim()) ?? [];
  const idx = Object.fromEntries(COLUMNAS.map((c) => [c, encabezado.indexOf(c)])) as Record<
    (typeof COLUMNAS)[number],
    number
  >;
  const faltan = COLUMNAS.filter((c) => idx[c] === -1);
  if (faltan.length > 0) throw new Error(`Faltan columnas en el CSV: ${faltan.join(", ")}`);

  return filas.map((f, i) => {
    if (f.length !== encabezado.length) {
      throw new Error(`Línea ${i + 2}: ${f.length} campos, se esperaban ${encabezado.length}.`);
    }
    return {
      linea: i + 2,
      nombre: f[idx.nombre].trim().replace(/\s+/g, " "),
      unidad: f[idx.unidad].trim().toUpperCase(),
      familia: f[idx.familia].trim(),
      codigoExistente: f[idx.codigo_existente]
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean),
    };
  });
}

async function armarPlan(filas: FilaCsv[]) {
  const [productos, catalogo] = await Promise.all([
    // Todos los productos, de cualquier estado y cliente: Producto.codigo es
    // único en toda la tabla y el consecutivo de la app tampoco filtra.
    prisma.producto.findMany({
      select: { codigo: true, nombre: true, familia: true, codigoManual: true },
    }),
    prisma.catalogoValor.findMany({
      where: { clienteId: CLIENTE_ID, tipo: { in: ["UNIDAD_MEDIDA", "FAMILIA"] } },
      select: { tipo: true, codigo: true, nombre: true, activo: true, orden: true },
    }),
  ]);

  const errores: string[] = [];

  // Catálogo: qué falta dar de alta. Un valor existente con otro nombre, o
  // inactivo, se reporta como error en vez de "arreglarlo" en silencio.
  const altasCatalogo: AltaCatalogo[] = [];
  const catalogoYaExiste: string[] = [];
  for (const req of CATALOGO_REQUERIDO) {
    const mismos = catalogo.filter((c) => c.tipo === req.tipo);
    const porCodigo = mismos.find((c) => c.codigo === req.codigo);
    const porNombre = mismos.find((c) => c.nombre === req.nombre);
    if (porCodigo) {
      if (porCodigo.nombre !== req.nombre) {
        errores.push(`Catálogo ${req.tipo}/${req.codigo} ya existe con nombre "${porCodigo.nombre}", se esperaba "${req.nombre}".`);
      } else if (!porCodigo.activo) {
        errores.push(`Catálogo ${req.tipo}/${req.codigo} "${req.nombre}" existe pero está INACTIVO.`);
      } else catalogoYaExiste.push(`${req.tipo}/${req.codigo} "${req.nombre}"`);
    } else if (porNombre) {
      errores.push(`Catálogo ${req.tipo}: "${req.nombre}" ya existe con código ${porNombre.codigo}, se esperaba ${req.codigo}.`);
    } else {
      const ordenMax = Math.max(0, ...mismos.map((c) => c.orden), ...altasCatalogo.filter((a) => a.tipo === req.tipo).map((a) => a.orden));
      altasCatalogo.push({ ...req, orden: ordenMax + 1 });
    }
  }

  // Nombres válidos = activos en el catálogo + los que esta corrida da de alta.
  const validos = (tipo: string) =>
    new Set([
      ...catalogo.filter((c) => c.tipo === tipo && c.activo).map((c) => c.nombre),
      ...altasCatalogo.filter((a) => a.tipo === tipo).map((a) => a.nombre),
    ]);
  const familiasValidas = validos("FAMILIA");
  const unidadesValidas = validos("UNIDAD_MEDIDA");

  // Nombre de familia → su código de catálogo, que es el prefijo del código.
  // Solo familias activas; si un nombre activo tuviera dos códigos, el prefijo
  // sería ambiguo y se reporta como error.
  const prefijoPorFamilia = new Map<string, string>();
  for (const c of [
    ...catalogo.filter((c) => c.tipo === "FAMILIA" && c.activo),
    ...altasCatalogo.filter((a) => a.tipo === "FAMILIA"),
  ]) {
    const previo = prefijoPorFamilia.get(c.nombre);
    if (previo && previo !== c.codigo) {
      errores.push(`Familia "${c.nombre}" tiene dos códigos activos en el catálogo (${previo}, ${c.codigo}): prefijo ambiguo.`);
    } else prefijoPorFamilia.set(c.nombre, c.codigo);
  }

  const codigosUsados = new Set(productos.map((p) => p.codigo));
  const porNombre = new Map<string, string>(); // nombre normalizado → código existente
  for (const p of productos) {
    const k = normalizarNombre(p.nombre);
    if (!porNombre.has(k)) porNombre.set(k, p.codigo);
  }
  // Consecutivo por familia, igual que obtenerSiguienteConsecutivoFamilia().
  const maxPorFamilia = new Map<string, number>();
  for (const p of productos) {
    const n = extraerConsecutivo(p.codigo);
    if (p.familia && n !== null && n > (maxPorFamilia.get(p.familia) ?? 0)) maxPorFamilia.set(p.familia, n);
  }

  const altas: Alta[] = [];
  const omitidas: Omitida[] = [];
  const rechazadas: Rechazada[] = [];
  const nombresEnCsv = new Map<string, number>();

  for (const f of filas) {
    const clave = normalizarNombre(f.nombre);
    const rechazar = (motivo: string) => rechazadas.push({ linea: f.linea, nombre: f.nombre, motivo });

    if (!f.nombre) {
      rechazar("nombre vacío");
      continue;
    }
    const lineaPrevia = nombresEnCsv.get(clave);
    if (lineaPrevia !== undefined) {
      rechazar(`nombre repetido en el CSV (línea ${lineaPrevia})`);
      continue;
    }
    nombresEnCsv.set(clave, f.linea);

    if (f.codigoExistente.length > 0) {
      const inexistentes = f.codigoExistente.filter((c) => !codigosUsados.has(c));
      if (inexistentes.length > 0) rechazar(`codigo_existente no está en la base: ${inexistentes.join(", ")}`);
      else omitidas.push({ linea: f.linea, nombre: f.nombre, motivo: `codigo_existente ${f.codigoExistente.join(" | ")}` });
      continue;
    }

    const existente = porNombre.get(clave);
    if (existente) {
      omitidas.push({ linea: f.linea, nombre: f.nombre, motivo: `ya existe por nombre (${existente})` });
      continue;
    }

    const unidadMedida = UNIDADES[f.unidad];
    if (!unidadMedida) {
      rechazar(`unidad "${f.unidad}" sin equivalencia (válidas: ${Object.keys(UNIDADES).join(", ")})`);
      continue;
    }
    if (!unidadesValidas.has(unidadMedida)) {
      rechazar(`unidad "${unidadMedida}" no está activa en el catálogo UNIDAD_MEDIDA`);
      continue;
    }
    if (!f.familia) {
      rechazar("sin familia (columna familia vacía y sin codigo_existente)");
      continue;
    }
    if (!familiasValidas.has(f.familia)) {
      rechazar(`familia "${f.familia}" no coincide EXACTO con una familia activa del catálogo`);
      continue;
    }

    const iniciales = inicialesDescripcion(f.nombre);
    if (!iniciales) {
      rechazar("no se pudo armar el código (nombre sin letras ni números)");
      continue;
    }
    const prefijo = `${prefijoPorFamilia.get(f.familia)}-${iniciales}`;
    let consecutivo = (maxPorFamilia.get(f.familia) ?? 0) + 1;
    let codigo = `${prefijo}-${formatearConsecutivo(consecutivo)}`;
    while (codigosUsados.has(codigo)) {
      consecutivo += 1;
      codigo = `${prefijo}-${formatearConsecutivo(consecutivo)}`;
    }
    codigosUsados.add(codigo);
    maxPorFamilia.set(f.familia, consecutivo);
    altas.push({ linea: f.linea, codigo, nombre: f.nombre, familia: f.familia, unidadMedida });
  }

  return { altasCatalogo, catalogoYaExiste, altas, omitidas, rechazadas, errores, prefijoPorFamilia };
}

// ── Reporte ──────────────────────────────────────────────────────────────────

function contarPor<T>(xs: T[], llave: (x: T) => string): Record<string, number> {
  return xs.reduce<Record<string, number>>((acc, x) => {
    const k = llave(x);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function imprimirPlan(plan: Awaited<ReturnType<typeof armarPlan>>) {
  const { altasCatalogo, catalogoYaExiste, altas, omitidas, rechazadas, errores, prefijoPorFamilia } = plan;
  const prefijoDe = (fam: string) => prefijoPorFamilia.get(fam) ?? "?";

  console.log("\n── Catálogo ──");
  for (const a of altasCatalogo) console.log(`  + ${a.tipo}/${a.codigo} "${a.nombre}" (orden ${a.orden})`);
  for (const c of catalogoYaExiste) console.log(`  = ${c} ya existe`);

  console.log(`\n── Productos a crear (${altas.length}) ──`);
  for (const a of altas) {
    console.log(`  L${String(a.linea).padStart(3)}  ${a.codigo.padEnd(16)} ${a.unidadMedida.padEnd(6)} ${a.familia.padEnd(44)} ${a.nombre}`);
  }

  console.log(`\n── Omitidos (${omitidas.length}) ──`);
  for (const o of omitidas) console.log(`  L${String(o.linea).padStart(3)}  ${o.nombre}  ← ${o.motivo}`);

  if (rechazadas.length > 0) {
    console.log(`\n── RECHAZADOS (${rechazadas.length}) ──`);
    for (const r of rechazadas) console.log(`  L${String(r.linea).padStart(3)}  ${r.nombre}  ✗ ${r.motivo}`);
  }
  if (errores.length > 0) {
    console.log(`\n── ERRORES DE CATÁLOGO (${errores.length}) ──`);
    for (const e of errores) console.log(`  ✗ ${e}`);
  }

  console.log("\n── Por familia (a crear) ──");
  const porFamilia = contarPor(altas, (a) => a.familia);
  for (const [fam, n] of Object.entries(porFamilia)) {
    console.log(`  ${String(n).padStart(3)}  ${prefijoDe(fam).padEnd(8)} ${fam}`);
  }
  // Con el código de catálogo no deberían repetirse, pero se avisa si pasa.
  const familiasPorPrefijo = new Map<string, string[]>();
  for (const fam of Object.keys(porFamilia)) {
    const p = prefijoDe(fam);
    familiasPorPrefijo.set(p, [...(familiasPorPrefijo.get(p) ?? []), fam]);
  }
  for (const [p, fams] of familiasPorPrefijo) {
    if (fams.length > 1) console.log(`  ⚠ El prefijo ${p} lo comparten: ${fams.join(" / ")}`);
  }
  console.log("\n── Por unidad (a crear) ──");
  for (const [u, n] of Object.entries(contarPor(altas, (a) => a.unidadMedida))) console.log(`  ${String(n).padStart(3)}  ${u}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════ CARGA DE MATERIALES ELÉCTRICOS ══════════");
  console.log(APLICAR ? "MODO: --apply (ESCRIBE en la base)" : "MODO: PRUEBA (no escribe nada)");
  console.log(`CSV: ${ARCHIVO}`);

  const filas = leerFilas();
  console.log(`Filas en el CSV: ${filas.length}`);

  const plan = await armarPlan(filas);
  imprimirPlan(plan);

  // Catálogo de proveedores: a quién se le asignaría cada familia a crear.
  // Sin los PROVEEDORES_EXCLUIDOS, igual que al escribir.
  const familiasPorProveedor = new Map(
    [...(await familiasAsignadasPorProveedor(prisma))].filter(([id]) => !PROVEEDORES_EXCLUIDOS[id])
  );
  console.log(`\nExcluidos del catálogo de proveedores: ${Object.values(PROVEEDORES_EXCLUIDOS).join("; ") || "ninguno"}`);
  console.log("\n── Asignación automática al catálogo de proveedores (por familia) ──");
  for (const [fam, n] of Object.entries(contarPor(plan.altas, (a) => a.familia))) {
    const proveedores = [...familiasPorProveedor.values()].filter((fs) => fs.includes(fam)).length;
    console.log(
      `  ${fam.padEnd(46)} ${String(n).padStart(3)} producto(s) × ${proveedores} proveedor(es) = ${n * proveedores} fila(s)` +
        (proveedores === 0 ? "  ⚠ nadie tiene esta familia: los productos quedan fuera de todo catálogo" : "")
    );
  }

  const { altasCatalogo, altas, omitidas, rechazadas, errores } = plan;
  const resumen = (verbo: string) =>
    `\n${verbo}: ${altas.length} · OMITIDOS: ${omitidas.length} · RECHAZADOS: ${rechazadas.length}` +
    ` · TOTAL: ${altas.length + omitidas.length + rechazadas.length}`;

  if (rechazadas.length > 0 || errores.length > 0) {
    console.error(resumen("SE CREARÍAN"));
    console.error("\n✗ Hay filas rechazadas o errores de catálogo. No se escribió nada. Corrige el CSV y repite.\n");
    process.exitCode = 1;
    return;
  }

  if (!APLICAR) {
    console.log(resumen("SE CREARÍAN"));
    console.log("\nMODO PRUEBA — no se escribió nada. Repite con --apply para aplicar.\n");
    return;
  }

  if (altas.length === 0 && altasCatalogo.length === 0) {
    console.log(resumen("CREADOS"));
    console.log("\nNada que hacer: todo ya existe.\n");
    return;
  }

  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const resp = await rl.question(
      `\n¿Crear ${altasCatalogo.length} valor(es) de catálogo y ${altas.length} producto(s)? Escribe SI para continuar: `
    );
    rl.close();
    if (resp.trim().toUpperCase() !== "SI") {
      console.log("Cancelado. No se escribió nada.\n");
      return;
    }
  }

  const creados = await prisma.$transaction(
    async (tx) => {
      // Revalidación dentro de la transacción: si entre el plan y ahora alguien
      // creó uno de estos nombres, se aborta todo en vez de duplicar.
      const actuales = await tx.producto.findMany({ select: { nombre: true } });
      const nombresActuales = new Set(actuales.map((p) => normalizarNombre(p.nombre)));
      const yaCreados = altas.filter((a) => nombresActuales.has(normalizarNombre(a.nombre)));
      if (yaCreados.length > 0) {
        throw new Error(
          `Productos creados por alguien más mientras corría el script: ${yaCreados.map((a) => a.nombre).join(", ")}. Vuelve a correrlo.`
        );
      }

      for (const a of altasCatalogo) {
        await tx.catalogoValor.upsert({
          where: { tipo_codigo_clienteId: { tipo: a.tipo, codigo: a.codigo, clienteId: CLIENTE_ID } },
          update: {},
          create: { tipo: a.tipo, codigo: a.codigo, nombre: a.nombre, orden: a.orden, clienteId: CLIENTE_ID },
        });
      }

      const { count } = await tx.producto.createMany({
        data: altas.map((a) => ({
          codigo: a.codigo,
          nombre: a.nombre,
          tipoItem: "Producto",
          familia: a.familia,
          unidadMedida: a.unidadMedida,
          monedaPredeterminada: "MXN",
          codigoManual: false,
          clienteId: CLIENTE_ID,
        })),
      });
      if (count !== altas.length) {
        throw new Error(`createMany insertó ${count} de ${altas.length}; se revierte todo.`);
      }

      // Catálogo de proveedores, en la MISMA transacción: los productos recién
      // creados se asignan a quien ya tiene su familia (catalogoPorFamilia.ts).
      const nuevos = await tx.producto.findMany({
        where: { codigo: { in: altas.map((a) => a.codigo) } },
        select: { id: true, familia: true },
      });
      // Misma regla que crearProducto, menos los PROVEEDORES_EXCLUIDOS (la
      // misma lista que asignar-materiales-por-familia.ts).
      const filasCatalogo = (await filasCatalogoPorFamilia(tx, nuevos)).filter(
        (f) => !PROVEEDORES_EXCLUIDOS[f.proveedorId]
      );
      const asignados =
        filasCatalogo.length > 0
          ? (await tx.proveedorMaterial.createMany({ data: filasCatalogo, skipDuplicates: true })).count
          : 0;
      return { count, asignados };
    },
    { timeout: 30_000 }
  );

  console.log(resumen("CREADOS").replace(`CREADOS: ${altas.length}`, `CREADOS: ${creados.count}`));
  console.log(`Catálogo: ${altasCatalogo.length} valor(es) dado(s) de alta.`);
  console.log(`Catálogo de proveedores: ${creados.asignados} asignación(es) por familia.`);
  console.log("\n✓ Listo. Correrlo de nuevo debe reportar 0 creados.\n");
}

main()
  .catch((e) => {
    console.error("\n✗ ERROR en cargar-materiales-electricos:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
