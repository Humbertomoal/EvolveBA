/**
 * Llena el catálogo de proveedores (ProveedorMaterial) a partir de las
 * familias que cada uno tiene asignadas: a cada proveedor con la familia F, le
 * agrega los productos de F que todavía no tiene.
 *
 * Correr:
 *   npx tsx scripts/asignar-materiales-por-familia.ts                          → MODO PRUEBA (no escribe nada)
 *   npx tsx scripts/asignar-materiales-por-familia.ts --apply                  → escribe (pide confirmación)
 *   npx tsx scripts/asignar-materiales-por-familia.ts --apply --yes            → escribe sin preguntar
 *   --incluir-anteriores   agrega también los productos ANTERIORES a la última
 *                          edición del catálogo de cada proveedor (ver abajo)
 *   --licitacion=0029      licitación cuya cobertura se reporta antes y después
 *   --familias=CANAL,CONSUM  limita la corrida a esas familias (CÓDIGOS del
 *                          catálogo FAMILIA). Sin el parámetro: todas.
 *   --detalle              lista, por proveedor y familia, qué productos recibe
 *
 * Proveedores excluidos siempre: ver PROVEEDORES_EXCLUIDOS (de prueba).
 *
 * ── Qué NO se agrega por defecto ──────────────────────────────────────────
 * El catálogo de un proveedor puede estar CURADO: si en la familia F desmarcó
 * a propósito un producto, volver a ponérselo deshace su decisión. La base no
 * guarda las desmarcas (sincronizarMaterialesDB borra la fila), así que la
 * regla es por fecha:
 *   · producto creado DESPUÉS de la última edición del catálogo del proveedor
 *     → nunca lo pudo elegir → SE AGREGA;
 *   · producto ANTERIOR → pudo elegirlo y no lo hizo → NO se agrega, salvo con
 *     --incluir-anteriores. El modo prueba los cuenta igual.
 * "Última edición" = la más reciente entre el último material agregado
 * (ProveedorMaterial.createdAt) y la validación del catálogo
 * (catalogoValidadoEn). Es una aproximación: una edición que SOLO quitó
 * materiales no deja fecha. Un proveedor sin ningún material nunca curó nada:
 * todo producto de sus familias se le agrega.
 *
 * ── Qué cuenta como "familia asignada" ────────────────────────────────────
 * La misma lectura que usan las pantallas (getFamiliasAsignadasProveedor):
 * Proveedor.familiasAsignadas y, si está vacía, el dato legado de
 * ProveedorMaterial.familias. Se comparan con Producto.familia (nombre).
 * Solo productos activos y no eliminados.
 *
 * ── Garantías ──────────────────────────────────────────────────────────────
 * · SOLO agrega. Nunca quita ni modifica filas existentes.
 * · Idempotente: createMany con skipDuplicates sobre @@unique(proveedorId,
 *   productoId). Correrlo dos veces no duplica.
 * · Todo en UNA transacción.
 * · No toca catalogoValidado: agregar materiales nuevos no "desvalida" lo que
 *   el proveedor ya revisó.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { prisma } from "../src/lib/prisma";
import { getFamiliasAsignadasProveedor } from "../src/lib/proveedorMaterialesData";
import { filtrarItemsPorMaterialesProveedor } from "../src/lib/proveedorMateriales";

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const INCLUIR_ANTERIORES = process.argv.includes("--incluir-anteriores");
const NUMERO_LICITACION =
  process.argv.find((a) => a.startsWith("--licitacion="))?.slice("--licitacion=".length) ?? "0029";
const CODIGOS_FAMILIA = process.argv
  .find((a) => a.startsWith("--familias="))
  ?.slice("--familias=".length)
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);
const DETALLE = process.argv.includes("--detalle");

/** Nunca reciben altas: proveedores de prueba. */
const PROVEEDORES_EXCLUIDOS: Record<string, string> = {
  cmwkzpizr000004l8pa63036j: "Ejemplo tadeo (de prueba)",
};

type Alta = { proveedorId: string; productoId: string; familias: string };

async function main() {
  // Familias a las que se limita la corrida (por código → nombre, que es lo que
  // guardan Producto.familia y familiasAsignadas). Un código desconocido aborta.
  let familiasPermitidas: Set<string> | null = null;
  if (CODIGOS_FAMILIA) {
    const valores = await prisma.catalogoValor.findMany({
      where: { tipo: "FAMILIA", codigo: { in: CODIGOS_FAMILIA } },
      select: { codigo: true, nombre: true },
    });
    const desconocidos = CODIGOS_FAMILIA.filter((c) => !valores.some((v) => v.codigo === c));
    if (desconocidos.length > 0) {
      throw new Error(`Código(s) de familia desconocido(s): ${desconocidos.join(", ")}. No se escribió nada.`);
    }
    familiasPermitidas = new Set(valores.map((v) => v.nombre));
  }

  const proveedores = await prisma.proveedor.findMany({
    where: { eliminado: false },
    select: { id: true, razonSocial: true, estado: true, catalogoValidadoEn: true },
    orderBy: { razonSocial: "asc" },
  });
  const productos = await prisma.producto.findMany({
    where: { activo: true, eliminado: false, familia: { not: null } },
    select: { id: true, codigo: true, nombre: true, familia: true, createdAt: true },
  });
  const catalogo = await prisma.proveedorMaterial.findMany({
    select: { proveedorId: true, productoId: true, createdAt: true },
  });
  const tiene = new Map<string, Set<string>>();
  const ultimaAlta = new Map<string, Date>();
  for (const r of catalogo) {
    if (!tiene.has(r.proveedorId)) tiene.set(r.proveedorId, new Set());
    tiene.get(r.proveedorId)!.add(r.productoId);
    const u = ultimaAlta.get(r.proveedorId);
    if (!u || r.createdAt > u) ultimaAlta.set(r.proveedorId, r.createdAt);
  }

  const altas: Alta[] = [];
  const porProveedor: {
    proveedor: string;
    estado: string;
    familias: number;
    ultima_edicion: string;
    agrega: number;
    anteriores_omitidos: number;
  }[] = [];
  const porFamilia = new Map<string, { proveedores: Set<string>; altas: number; omitidos: number }>();
  const detalle: { proveedor: string; familia: string; codigo: string; producto: string }[] = [];
  const nombreProducto = new Map(productos.map((p) => [p.id, p]));

  for (const p of proveedores) {
    if (PROVEEDORES_EXCLUIDOS[p.id]) continue;
    const familias = await getFamiliasAsignadasProveedor(p.id);
    if (familias.length === 0) continue;
    const familiasCorrida = familiasPermitidas
      ? familias.filter((f) => familiasPermitidas!.has(f))
      : familias;
    if (familiasCorrida.length === 0) continue;
    const suyos = tiene.get(p.id) ?? new Set<string>();
    const candidatos = [ultimaAlta.get(p.id), p.catalogoValidadoEn].filter((d): d is Date => !!d);
    const ultimaEdicion = suyos.size === 0 || candidatos.length === 0
      ? null
      : new Date(Math.max(...candidatos.map((d) => d.getTime())));
    let agrega = 0;
    let omitidos = 0;
    for (const prod of productos) {
      if (!familiasCorrida.includes(prod.familia!) || suyos.has(prod.id)) continue;
      const fam = porFamilia.get(prod.familia!) ?? { proveedores: new Set(), altas: 0, omitidos: 0 };
      porFamilia.set(prod.familia!, fam);
      const pudoElegirlo = ultimaEdicion !== null && prod.createdAt <= ultimaEdicion;
      if (pudoElegirlo && !INCLUIR_ANTERIORES) {
        omitidos++;
        fam.omitidos++;
        continue;
      }
      altas.push({ proveedorId: p.id, productoId: prod.id, familias: JSON.stringify(familias) });
      detalle.push({
        proveedor: p.razonSocial.slice(0, 40),
        familia: prod.familia!,
        codigo: nombreProducto.get(prod.id)!.codigo,
        producto: nombreProducto.get(prod.id)!.nombre.slice(0, 50),
      });
      agrega++;
      fam.altas++;
      fam.proveedores.add(p.id);
    }
    porProveedor.push({
      proveedor: p.razonSocial.slice(0, 40),
      estado: p.estado,
      familias: familias.length,
      ultima_edicion: ultimaEdicion ? ultimaEdicion.toISOString().slice(0, 10) : "nunca curó",
      agrega,
      anteriores_omitidos: omitidos,
    });
  }

  // ── Cobertura de la licitación, antes y después ──────────────────────────
  const lic = await prisma.licitacion.findUnique({
    where: { numero: NUMERO_LICITACION },
    select: { items: { where: { eliminado: false }, select: { productoId: true } } },
  });
  const cobertura = (tabla: Map<string, Set<string>>) => {
    if (!lic) return null;
    const mats = new Set(lic.items.map((i) => i.productoId));
    const sinProveedor = [...mats].filter((m) => ![...tabla.values()].some((s) => s.has(m))).length;
    const vista = proveedores.map((p) => {
      const suyos = [...(tabla.get(p.id) ?? [])];
      const coinciden = lic.items.filter((i) => suyos.includes(i.productoId)).length;
      return {
        id: p.id,
        visibles: filtrarItemsPorMaterialesProveedor(lic.items, suyos).length,
        respaldo: suyos.length === 0 ? "sin catálogo" : coinciden === 0 ? "nada coincide" : "",
      };
    });
    return { materiales: mats.size, sinProveedor, vista };
  };
  const despues = new Map([...tiene].map(([k, v]) => [k, new Set(v)]));
  for (const a of altas) {
    if (!despues.has(a.proveedorId)) despues.set(a.proveedorId, new Set());
    despues.get(a.proveedorId)!.add(a.productoId);
  }
  const cAntes = cobertura(tiene);
  const cDespues = cobertura(despues);

  // ── Reporte ──────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}` +
    `${INCLUIR_ANTERIORES ? " · CON --incluir-anteriores" : ""}` +
    `${familiasPermitidas ? ` · SOLO familias: ${[...familiasPermitidas].join(", ")}` : " · todas las familias"}\n${linea}`);
  console.log(`Excluidos: ${Object.values(PROVEEDORES_EXCLUIDOS).join(", ")}`);
  console.log(`\nPor proveedor (solo los que tienen familias asignadas):`);
  console.table(porProveedor.sort((a, b) => b.agrega - a.agrega));
  console.log(`Por familia:`);
  console.table(
    [...porFamilia.entries()]
      .map(([familia, v]) => ({ familia, proveedores_que_reciben: v.proveedores.size, altas: v.altas, anteriores_omitidos: v.omitidos }))
      .sort((a, b) => b.altas - a.altas)
  );
  if (DETALLE) {
    console.log(`Detalle: qué recibe cada proveedor`);
    let actual = "";
    for (const d of detalle.sort((a, b) =>
      a.proveedor.localeCompare(b.proveedor) || a.familia.localeCompare(b.familia) || a.codigo.localeCompare(b.codigo)
    )) {
      const cabeza = `${d.proveedor} · ${d.familia}`;
      if (cabeza !== actual) {
        actual = cabeza;
        const n = detalle.filter((x) => x.proveedor === d.proveedor && x.familia === d.familia).length;
        console.log(`\n  ${cabeza} (${n})`);
      }
      console.log(`    ${d.codigo.padEnd(16)} ${d.producto}`);
    }
    console.log("");
  }
  const omitidosTotal = porProveedor.reduce((s, p) => s + p.anteriores_omitidos, 0);
  console.log(`Total a agregar: ${altas.length} filas de ProveedorMaterial` +
    (INCLUIR_ANTERIORES ? "" : ` · omitidos por anteriores (posibles desmarcas): ${omitidosTotal}`));

  if (cAntes && cDespues) {
    console.log(`\nCobertura de la licitación ${NUMERO_LICITACION} (${cAntes.materiales} materiales):`);
    console.log(`  Materiales sin ningún proveedor: ${cAntes.sinProveedor} → ${cDespues.sinProveedor}`);
    const filas = proveedores
      .map((p, i) => ({
        proveedor: p.razonSocial.slice(0, 36),
        ve_antes: cAntes.vista[i].visibles,
        ve_despues: cDespues.vista[i].visibles,
        respaldo_antes: cAntes.vista[i].respaldo,
        respaldo_despues: cDespues.vista[i].respaldo,
      }))
      .filter((f) => f.ve_antes !== f.ve_despues || f.respaldo_antes !== f.respaldo_despues);
    console.log(`  Proveedores cuya vista cambia (${filas.length}); con la regla de respaldo ACTUAL:`);
    console.table(filas);
  } else {
    console.log(`\n(No existe la licitación ${NUMERO_LICITACION}: no se reporta cobertura.)`);
  }

  if (!APLICAR) {
    console.log(`\n${linea}\nNo se escribió nada. Repite con --apply para agregar ${altas.length} filas.\n${linea}\n`);
    return;
  }
  if (altas.length === 0) {
    console.log("\nNada que agregar.\n");
    return;
  }
  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`\n¿Agregar ${altas.length} materiales a catálogos de proveedores? Escribe ASIGNAR para continuar: `);
    rl.close();
    if (r.trim().toUpperCase() !== "ASIGNAR") {
      console.log("Cancelado. No se escribió nada.\n");
      return;
    }
  }
  const { count } = await prisma.$transaction(async (tx) =>
    tx.proveedorMaterial.createMany({ data: altas, skipDuplicates: true })
  );
  console.log(`\n✓ Agregadas ${count} filas de ProveedorMaterial (de ${altas.length} planeadas).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
