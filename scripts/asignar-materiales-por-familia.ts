/**
 * Llena el catálogo de proveedores (ProveedorMaterial) a partir de sus
 * familias, y opcionalmente les ASIGNA familias nuevas en la misma transacción.
 *
 * Correr:
 *   npx tsx scripts/asignar-materiales-por-familia.ts [opciones]          → MODO PRUEBA (no escribe nada)
 *   … --apply                                                              → escribe (pide confirmación)
 *   … --apply --yes                                                        → escribe sin preguntar
 *
 * Opciones:
 *   --familias=MECA,CANAL   limita la corrida a esas familias (CÓDIGOS del catálogo
 *                           FAMILIA). Un código desconocido aborta.
 *   --proveedores=<csv>     limita la corrida a los proveedores del archivo (columna
 *                           `id`). Un id inexistente, eliminado o excluido aborta.
 *   --asignar-familias      además ASIGNA las --familias a los --proveedores
 *                           (requiere ambos). Solo AGREGA a familiasAsignadas,
 *                           conservando las existentes y su orden; nunca quita.
 *   --incluir-anteriores    agrega también los productos que el proveedor pudo
 *                           curar y no eligió (ver la regla). Rara vez hace falta.
 *   --licitacion=0029       licitación cuya cobertura se reporta antes y después.
 *   --detalle               lista qué producto recibe cada proveedor.
 *
 * Ejemplo (familias eléctricas, 2026-11-20):
 *   npx tsx scripts/asignar-materiales-por-familia.ts --asignar-familias \
 *     --familias=MECA,MECD,CANAL,CHAROLA,CONSUM,TIERRAS \
 *     --proveedores=scripts/datos/proveedores_familias_electricas.csv
 *
 * ── La regla: por par (proveedor, familia) ────────────────────────────────
 * El catálogo de un proveedor puede estar CURADO: si desmarcó a propósito un
 * producto, volver a ponérselo deshace su decisión. La base no guarda las
 * desmarcas (sincronizarMaterialesDB borra la fila), así que:
 *
 *   · Familia que se le ASIGNA en esta corrida (no estaba en sus familias):
 *     ningún producto suyo es "anterior". Nunca pudo curarla: se agregan todos.
 *   · Familia que YA tenía: solo se agregan los productos creados DESPUÉS de
 *     su última edición HUMANA del catálogo. Los anteriores pudo elegirlos y no
 *     lo hizo, así que se omiten (salvo --incluir-anteriores) y se reportan.
 *
 * "Última edición humana" = la más reciente entre catalogoValidadoEn y las
 * filas de ProveedorMaterial que guardó una persona. Una persona edita UN
 * proveedor a la vez (formulario del proveedor, portal), así que un instante en
 * que se crearon filas para VARIOS proveedores es una escritura automática
 * (este script, la carga de materiales, la asignación al crear un producto) y
 * NO cuenta. Límite conocido: una escritura automática que tocara a un solo
 * proveedor parecería humana; el modo prueba lo advierte para esta corrida.
 *
 * ── Garantías ──────────────────────────────────────────────────────────────
 * · Solo AGREGA: ni familias ni materiales se quitan o modifican.
 * · Una sola transacción: familias asignadas + altas. Dentro de ella se
 *   comprueba que las familias de cada proveedor no cambiaron desde el plan;
 *   si cambiaron, no se escribe nada.
 * · Idempotente: altas con skipDuplicates; familias ya presentes no se repiten.
 * · No toca catalogoValidado.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { prisma } from "../src/lib/prisma";
import { familiasAsignadasPorProveedor } from "../src/lib/catalogoPorFamilia";
import { filtrarItemsPorMaterialesProveedor } from "../src/lib/proveedorMateriales";

const arg = (nombre: string) =>
  process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");
const INCLUIR_ANTERIORES = process.argv.includes("--incluir-anteriores");
const ASIGNAR_FAMILIAS = process.argv.includes("--asignar-familias");
const DETALLE = process.argv.includes("--detalle");
const NUMERO_LICITACION = arg("licitacion") ?? "0029";
const ARCHIVO_PROVEEDORES = arg("proveedores");
const CODIGOS_FAMILIA = arg("familias")
  ?.split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

/** Nunca reciben nada: proveedores de prueba sin confirmar. */
const PROVEEDORES_EXCLUIDOS: Record<string, string> = {
  cmwkzpizr000004l8pa63036j: "Ejemplo tadeo (pendiente de verificar quién es)",
};

const CORTO: Record<string, string> = {
  "Material Eléctrico de Corriente Alterna": "CA",
  "Material Eléctrico de Corriente Directa": "CD",
  "Canalización": "Canal",
  "Sistema de Charola Portacables": "Charola",
  "Material Consumible para Instalación de SFV": "Consum",
  "Sistema de Tierras": "Tierras",
  "Servicios Profesionales": "ServProf",
  "Panales Solares": "Paneles",
  "Inversores": "Inv",
  "Estructura": "Estruc",
  "Mano de Obra": "MObra",
};
const corto = (f: string) => CORTO[f] ?? f;

type Alta = { proveedorId: string; productoId: string; familias: string };

/** Primera columna (`id`) de un CSV con encabezado. */
function leerIdsProveedores(ruta: string): string[] {
  const lineas = readFileSync(resolve(ruta), "utf-8").replace(/^﻿/, "").split(/\r?\n/);
  const [encabezado, ...resto] = lineas;
  if (encabezado.split(",")[0].trim() !== "id") throw new Error(`${ruta}: la primera columna debe llamarse "id".`);
  return resto.map((l) => l.split(",")[0].trim()).filter(Boolean);
}

async function main() {
  if (ASIGNAR_FAMILIAS && (!CODIGOS_FAMILIA || !ARCHIVO_PROVEEDORES)) {
    throw new Error("--asignar-familias requiere --familias y --proveedores. No se escribió nada.");
  }

  // ── Familias de la corrida (código → nombre) ─────────────────────────────
  let familiasPedidas: string[] | null = null;
  if (CODIGOS_FAMILIA) {
    const valores = await prisma.catalogoValor.findMany({
      where: { tipo: "FAMILIA", codigo: { in: CODIGOS_FAMILIA }, activo: true },
      select: { codigo: true, nombre: true },
    });
    const desconocidos = CODIGOS_FAMILIA.filter((c) => !valores.some((v) => v.codigo === c));
    if (desconocidos.length > 0) {
      throw new Error(`Código(s) de familia desconocido(s) o inactivo(s): ${desconocidos.join(", ")}. No se escribió nada.`);
    }
    familiasPedidas = CODIGOS_FAMILIA.map((c) => valores.find((v) => v.codigo === c)!.nombre);
  }

  // ── Proveedores ──────────────────────────────────────────────────────────
  const proveedores = await prisma.proveedor.findMany({
    where: { eliminado: false },
    select: { id: true, razonSocial: true, estado: true, catalogoValidadoEn: true, usuarioId: true },
    orderBy: { razonSocial: "asc" },
  });
  let destino = proveedores.filter((p) => !PROVEEDORES_EXCLUIDOS[p.id]);
  if (ARCHIVO_PROVEEDORES) {
    const ids = leerIdsProveedores(ARCHIVO_PROVEEDORES);
    const problemas = ids.flatMap((id) =>
      PROVEEDORES_EXCLUIDOS[id]
        ? [`${id} está excluido: ${PROVEEDORES_EXCLUIDOS[id]}`]
        : proveedores.some((p) => p.id === id)
          ? []
          : [`${id} no existe o está eliminado`]
    );
    if (problemas.length > 0) throw new Error(`Archivo de proveedores:\n  ${problemas.join("\n  ")}\nNo se escribió nada.`);
    destino = ids.map((id) => proveedores.find((p) => p.id === id)!);
  }

  const familiasAntes = await familiasAsignadasPorProveedor(prisma);
  const productos = await prisma.producto.findMany({
    where: { activo: true, eliminado: false, familia: { not: null } },
    select: { id: true, codigo: true, nombre: true, familia: true, createdAt: true },
  });
  const catalogo = await prisma.proveedorMaterial.findMany({
    select: { proveedorId: true, productoId: true, createdAt: true },
  });

  // ── Última edición HUMANA ────────────────────────────────────────────────
  // Instante compartido por varios proveedores = escritura automática.
  const proveedoresPorInstante = new Map<number, Set<string>>();
  for (const r of catalogo) {
    const t = r.createdAt.getTime();
    if (!proveedoresPorInstante.has(t)) proveedoresPorInstante.set(t, new Set());
    proveedoresPorInstante.get(t)!.add(r.proveedorId);
  }
  const tiene = new Map<string, Set<string>>();
  const ultimaHumana = new Map<string, Date>();
  for (const r of catalogo) {
    if (!tiene.has(r.proveedorId)) tiene.set(r.proveedorId, new Set());
    tiene.get(r.proveedorId)!.add(r.productoId);
    if (proveedoresPorInstante.get(r.createdAt.getTime())!.size > 1) continue;
    const u = ultimaHumana.get(r.proveedorId);
    if (!u || r.createdAt > u) ultimaHumana.set(r.proveedorId, r.createdAt);
  }
  const edicionHumana = (p: (typeof proveedores)[number]): Date | null => {
    const fechas = [ultimaHumana.get(p.id), p.catalogoValidadoEn].filter((d): d is Date => !!d);
    return fechas.length === 0 ? null : new Date(Math.max(...fechas.map((d) => d.getTime())));
  };

  // ── Plan ─────────────────────────────────────────────────────────────────
  const altas: Alta[] = [];
  const cambiosFamilias: { proveedorId: string; antes: string[]; despues: string[] }[] = [];
  const filasProveedor: Record<string, string | number>[] = [];
  const filasFamilias: Record<string, string | number>[] = [];
  const porFamilia = new Map<string, { proveedores: Set<string>; altas: number; omitidas: number }>();
  const detalle: string[] = [];

  for (const p of destino) {
    const antes = familiasAntes.get(p.id) ?? [];
    const despues = ASIGNAR_FAMILIAS ? [...antes, ...familiasPedidas!.filter((f) => !antes.includes(f))] : antes;
    if (despues.length !== antes.length) cambiosFamilias.push({ proveedorId: p.id, antes, despues });
    const corrida = familiasPedidas ? despues.filter((f) => familiasPedidas!.includes(f)) : despues;
    if (corrida.length === 0) continue;

    const suyos = tiene.get(p.id) ?? new Set<string>();
    const humana = edicionHumana(p);
    const fila: Record<string, string | number> = { proveedor: p.razonSocial.slice(0, 32) };
    let totalAltas = 0;
    let totalOmitidas = 0;
    for (const f of corrida) {
      const nueva = !antes.includes(f);
      const faltan = productos.filter((x) => x.familia === f && !suyos.has(x.id));
      const entran = faltan.filter((x) => nueva || INCLUIR_ANTERIORES || !humana || x.createdAt > humana);
      const omitidas = faltan.length - entran.length;
      for (const x of entran) {
        altas.push({ proveedorId: p.id, productoId: x.id, familias: JSON.stringify(despues) });
        if (DETALLE) detalle.push(`${p.razonSocial.slice(0, 32).padEnd(32)} ${corto(f).padEnd(8)} ${x.codigo.padEnd(16)} ${x.nombre.slice(0, 50)}`);
      }
      fila[corto(f)] = entran.length || "";
      totalAltas += entran.length;
      totalOmitidas += omitidas;
      const pf = porFamilia.get(f) ?? { proveedores: new Set(), altas: 0, omitidas: 0 };
      if (entran.length) pf.proveedores.add(p.id);
      pf.altas += entran.length;
      pf.omitidas += omitidas;
      porFamilia.set(f, pf);
    }
    fila.altas = totalAltas;
    fila.omitidas_curadas = totalOmitidas;
    fila.ultima_edicion_humana = humana ? humana.toISOString().slice(0, 10) : "nunca curó";
    fila.portal = p.usuarioId ? "sí" : "NO";
    filasProveedor.push(fila);
    filasFamilias.push({
      proveedor: p.razonSocial.slice(0, 32),
      antes: antes.map(corto).join(", ") || "(ninguna)",
      se_agregan: despues.filter((f) => !antes.includes(f)).map(corto).join(", ") || "—",
      quedan: despues.length,
    });
  }

  // ── Cobertura de la licitación ───────────────────────────────────────────
  const lic = await prisma.licitacion.findUnique({
    where: { numero: NUMERO_LICITACION },
    select: { items: { where: { eliminado: false }, select: { productoId: true } } },
  });
  const despuesCatalogo = new Map([...tiene].map(([k, v]) => [k, new Set(v)]));
  for (const a of altas) {
    if (!despuesCatalogo.has(a.proveedorId)) despuesCatalogo.set(a.proveedorId, new Set());
    despuesCatalogo.get(a.proveedorId)!.add(a.productoId);
  }

  // ── Reporte ──────────────────────────────────────────────────────────────
  const linea = "─".repeat(78);
  console.log(`\n${linea}\n${APLICAR ? "APLICAR" : "MODO PRUEBA (no se escribe nada)"}` +
    `${ASIGNAR_FAMILIAS ? " · ASIGNA FAMILIAS" : ""}${INCLUIR_ANTERIORES ? " · CON --incluir-anteriores" : ""}\n${linea}`);
  console.log(`Familias: ${familiasPedidas ? familiasPedidas.map(corto).join(", ") : "todas las asignadas"}`);
  console.log(`Proveedores: ${ARCHIVO_PROVEEDORES ? `${destino.length} del archivo ${ARCHIVO_PROVEEDORES}` : "todos los que tienen familias"}`);
  console.log(`Excluidos: ${Object.values(PROVEEDORES_EXCLUIDOS).join("; ")}`);

  if (ASIGNAR_FAMILIAS) {
    console.log(`\n1) familiasAsignadas, antes y después (solo se agrega; ${cambiosFamilias.length} proveedor(es) cambian)`);
    console.table(filasFamilias);
  }
  console.log(`\n2) Altas por proveedor y familia`);
  console.table(filasProveedor);
  console.log(`3) Por familia`);
  console.table(
    [...porFamilia.entries()].map(([f, v]) => ({ familia: f, proveedores_que_reciben: v.proveedores.size, altas: v.altas, omitidas_curadas: v.omitidas }))
  );
  const omitidas = filasProveedor.reduce((s, f) => s + Number(f.omitidas_curadas), 0);
  console.log(`Total: ${altas.length} altas · ${omitidas} omitidas.`);
  if (omitidas > 0 && !INCLUIR_ANTERIORES) {
    console.log("  Motivo de las omitidas: producto ANTERIOR a la última edición humana del catálogo, en una familia que");
    console.log("  el proveedor YA tenía. Pudo elegirlo y no lo hizo: se respeta su decisión.");
  }
  const tocados = new Set(altas.map((a) => a.proveedorId));
  if (tocados.size === 1) {
    console.log("  ⚠ Las altas tocan a UN solo proveedor: en corridas futuras parecerán una edición humana suya.");
  }

  if (lic) {
    const mats = [...new Set(lic.items.map((i) => i.productoId))];
    const huerfanos = (cat: Map<string, Set<string>>) => mats.filter((m) => ![...cat.values()].some((s) => s.has(m))).length;
    console.log(`\n4) Cobertura de la licitación ${NUMERO_LICITACION} (${lic.items.length} partidas, ${mats.length} materiales)`);
    console.log(`   Materiales sin ningún proveedor: ${huerfanos(tiene)} → ${huerfanos(despuesCatalogo)}`);
    console.table(
      destino.map((p) => ({
        proveedor: p.razonSocial.slice(0, 32),
        ve_antes: filtrarItemsPorMaterialesProveedor(lic.items, [...(tiene.get(p.id) ?? [])]).length,
        ve_despues: filtrarItemsPorMaterialesProveedor(lic.items, [...(despuesCatalogo.get(p.id) ?? [])]).length,
      }))
    );
  }
  if (DETALLE) console.log(`\nDetalle:\n  ${detalle.join("\n  ")}`);

  if (!APLICAR) {
    console.log(`\n${linea}\nNo se escribió nada. Repite con --apply para aplicar.\n${linea}\n`);
    return;
  }
  if (altas.length === 0 && cambiosFamilias.length === 0) {
    console.log("\nNada que hacer.\n");
    return;
  }
  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(
      `\n¿Asignar familias a ${cambiosFamilias.length} proveedor(es) y agregar ${altas.length} materiales? Escribe ASIGNAR para continuar: `
    );
    rl.close();
    if (r.trim().toUpperCase() !== "ASIGNAR") {
      console.log("Cancelado. No se escribió nada.\n");
      return;
    }
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      // Las familias no deben haber cambiado desde el plan.
      const ahora = await familiasAsignadasPorProveedor(tx);
      for (const c of cambiosFamilias) {
        if (JSON.stringify(ahora.get(c.proveedorId) ?? []) !== JSON.stringify(c.antes)) {
          throw new Error(`Las familias del proveedor ${c.proveedorId} cambiaron mientras corría el script. No se escribió nada.`);
        }
        await tx.proveedor.update({
          where: { id: c.proveedorId },
          data: { familiasAsignadas: JSON.stringify(c.despues) },
        });
      }
      // Un solo instante para todo el lote: así queda marcado como escritura
      // automática (varios proveedores, mismo instante) para corridas futuras.
      const instante = new Date();
      const { count } = altas.length
        ? await tx.proveedorMaterial.createMany({
            data: altas.map((a) => ({ ...a, createdAt: instante })),
            skipDuplicates: true,
          })
        : { count: 0 };
      return { familias: cambiosFamilias.length, altas: count };
    },
    { timeout: 30_000 }
  );
  console.log(`\n✓ Familias asignadas a ${resultado.familias} proveedor(es); ${resultado.altas} materiales agregados (de ${altas.length} planeados).\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
