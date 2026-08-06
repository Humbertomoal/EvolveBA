/**
 * Borra TODO lo que generó seed-demo.ts y nada más.
 *
 * Correr:
 *   npx tsx scripts/limpiar-demo.ts            → DRY RUN (solo lista)
 *   npx tsx scripts/limpiar-demo.ts --apply    → borra (pide confirmación)
 *   npx tsx scripts/limpiar-demo.ts --apply --yes
 *
 * ── Cómo decide qué borrar ─────────────────────────────────────────────────
 * Solo por marcadores (scripts/demo-marcadores.ts):
 *   · Licitacion.numero      LIKE 'DMY-%'
 *   · OrdenCompra.numero     LIKE 'OC-DMY-%'
 *   · Proveedor.razonSocial  LIKE '[DUMMY] %'
 *   · Usuario.email          LIKE '%@proveedores-demo.mx'
 * Nada se borra por inferencia: si una fila no lleva marcador, no se toca.
 *
 * ── Orden de borrado ───────────────────────────────────────────────────────
 * El schema NO tiene un solo `onDelete` (0 ocurrencias), así que no hay
 * cascada: hay que borrar hijos antes que padres o Postgres rechaza el DELETE.
 * El orden de abajo es obligatorio, no estilístico. En particular, Proveedor
 * debe morir ANTES que su Usuario (la FK va Proveedor.usuarioId → Usuario).
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from ".prisma/client/default";
import {
  DOMINIO_LOGIN_DEMO,
  PREFIJO_LICITACION,
  PREFIJO_ORDEN,
  PREFIJO_RAZON_SOCIAL,
} from "./demo-marcadores";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--apply");
const SIN_PREGUNTAR = process.argv.includes("--yes");

async function main() {
  console.log("\n══════════ LIMPIAR DEMO ══════════");
  console.log(APLICAR ? "MODO: --apply (BORRA)" : "MODO: DRY RUN (solo lista)");

  // ── Qué se va a borrar ────────────────────────────────────────────────────
  const licitaciones = await prisma.licitacion.findMany({
    where: { numero: { startsWith: PREFIJO_LICITACION } },
    select: { id: true, numero: true },
    orderBy: { numero: "asc" },
  });
  const licIds = licitaciones.map((l) => l.id);

  const proveedores = await prisma.proveedor.findMany({
    where: { razonSocial: { startsWith: PREFIJO_RAZON_SOCIAL } },
    select: { id: true, razonSocial: true, rfc: true, usuarioId: true, contactoAdminCorreo: true },
    orderBy: { razonSocial: "asc" },
  });
  const provIds = proveedores.map((p) => p.id);
  const usuarioIds = proveedores.map((p) => p.usuarioId).filter((u): u is string => Boolean(u));

  const usuarios = await prisma.usuario.findMany({
    where: {
      OR: [{ email: { endsWith: DOMINIO_LOGIN_DEMO } }, { id: { in: usuarioIds } }],
    },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      OR: [{ numero: { startsWith: PREFIJO_ORDEN } }, { licitacionId: { in: licIds } }],
    },
    select: { id: true, numero: true },
  });
  const ordenIds = ordenes.map((o) => o.id);

  const [items, ofertas, asignaciones, lineas, logs, invitados, mensajes, materiales] =
    await Promise.all([
      prisma.licitacionItem.count({ where: { licitacionId: { in: licIds } } }),
      prisma.ofertaItem.count({ where: { licitacionItem: { licitacionId: { in: licIds } } } }),
      prisma.asignacionMaterial.count({ where: { licitacionId: { in: licIds } } }),
      prisma.ordenCompraLinea.count({ where: { ordenCompraId: { in: ordenIds } } }),
      prisma.licitacionEstadoLog.count({ where: { licitacionId: { in: licIds } } }),
      prisma.licitacionProveedor.count({ where: { licitacionId: { in: licIds } } }),
      prisma.chatMensaje.count({ where: { licitacionId: { in: licIds } } }),
      prisma.proveedorMaterial.count({ where: { proveedorId: { in: provIds } } }),
    ]);

  if (licitaciones.length === 0 && proveedores.length === 0 && usuarios.length === 0) {
    console.log("\nNo hay datos de demo. Nada que borrar.\n");
    return;
  }

  console.log("\n── SE VA A BORRAR ──");
  console.log(`Licitaciones (${licitaciones.length})  ← numero LIKE '${PREFIJO_LICITACION}%'`);
  if (licitaciones.length > 0) {
    console.log(`   ${licitaciones.map((l) => l.numero).join(", ")}`);
  }
  console.log(`Proveedores (${proveedores.length})  ← razonSocial LIKE '${PREFIJO_RAZON_SOCIAL}%'`);
  proveedores.forEach((p) =>
    console.log(`   · ${p.razonSocial.padEnd(50)} ${p.rfc}  ${p.contactoAdminCorreo}`)
  );
  console.log(`Usuarios de portal (${usuarios.length})  ← email LIKE '%${DOMINIO_LOGIN_DEMO}'`);
  usuarios.forEach((u) => console.log(`   · ${u.email}`));
  console.log(`Órdenes de compra (${ordenes.length})  ← numero LIKE '${PREFIJO_ORDEN}%'`);
  console.log(
    `Dependientes: ${items} items · ${ofertas} ofertas · ${asignaciones} asignaciones · ` +
      `${lineas} líneas de OC · ${logs} logs de estado · ${invitados} invitaciones · ` +
      `${mensajes} mensajes · ${materiales} materiales de proveedor`
  );

  // ── Qué NO se toca ────────────────────────────────────────────────────────
  const [provReales, licReales, ocReales, usuariosReales, productos] = await Promise.all([
    prisma.proveedor.findMany({
      where: { razonSocial: { not: { startsWith: PREFIJO_RAZON_SOCIAL } } },
      select: { razonSocial: true, rfc: true },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.licitacion.findMany({
      where: { numero: { not: { startsWith: PREFIJO_LICITACION } } },
      select: { numero: true },
      orderBy: { numero: "asc" },
    }),
    prisma.ordenCompra.findMany({
      where: { numero: { not: { startsWith: PREFIJO_ORDEN } } },
      select: { numero: true },
      orderBy: { numero: "asc" },
    }),
    prisma.usuario.count({ where: { email: { not: { endsWith: DOMINIO_LOGIN_DEMO } } } }),
    prisma.producto.count(),
  ]);

  console.log("\n── NO SE TOCA ──");
  console.log(`Proveedores reales (${provReales.length}):`);
  provReales.forEach((p) => console.log(`   · ${p.razonSocial.padEnd(50)} ${p.rfc}`));
  console.log(`Licitaciones reales (${licReales.length}): ${licReales.map((l) => l.numero).join(", ") || "—"}`);
  console.log(`OC reales (${ocReales.length}): ${ocReales.map((o) => o.numero).join(", ") || "—"}`);
  console.log(`Usuarios reales: ${usuariosReales} · Productos: ${productos} · Roles y catálogos: intactos`);

  if (!APLICAR) {
    console.log("\nDRY RUN — no se borró nada. Repite con --apply para borrar.\n");
    return;
  }

  if (!SIN_PREGUNTAR) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const resp = await rl.question("\n¿Borrar todo lo listado arriba? Escribe BORRAR para continuar: ");
    rl.close();
    if (resp.trim().toUpperCase() !== "BORRAR") {
      console.log("Cancelado. No se borró nada.\n");
      return;
    }
  }

  // ── Borrado, hijos → padres (sin onDelete en el schema, el orden es forzoso)
  const borrado: Record<string, number> = {};
  const reg = (k: string, r: { count: number }) => {
    borrado[k] = r.count;
  };

  reg("OrdenCompraLinea", await prisma.ordenCompraLinea.deleteMany({ where: { ordenCompraId: { in: ordenIds } } }));
  reg("OrdenCompra", await prisma.ordenCompra.deleteMany({ where: { id: { in: ordenIds } } }));
  reg("AsignacionMaterial", await prisma.asignacionMaterial.deleteMany({ where: { licitacionId: { in: licIds } } }));
  reg("OfertaItem", await prisma.ofertaItem.deleteMany({ where: { licitacionItem: { licitacionId: { in: licIds } } } }));
  reg("LicitacionItem", await prisma.licitacionItem.deleteMany({ where: { licitacionId: { in: licIds } } }));
  reg("LicitacionProveedor", await prisma.licitacionProveedor.deleteMany({ where: { licitacionId: { in: licIds } } }));
  reg("LicitacionEstadoLog", await prisma.licitacionEstadoLog.deleteMany({ where: { licitacionId: { in: licIds } } }));
  reg("ChatMensaje", await prisma.chatMensaje.deleteMany({ where: { licitacionId: { in: licIds } } }));
  reg("Licitacion", await prisma.licitacion.deleteMany({ where: { id: { in: licIds } } }));
  reg("ProveedorMaterial", await prisma.proveedorMaterial.deleteMany({ where: { proveedorId: { in: provIds } } }));
  // Proveedor ANTES que Usuario: la FK va Proveedor.usuarioId → Usuario.
  reg("Proveedor", await prisma.proveedor.deleteMany({ where: { id: { in: provIds } } }));
  reg("Usuario", await prisma.usuario.deleteMany({ where: { id: { in: usuarios.map((u) => u.id) } } }));

  console.log("\n── BORRADO ──");
  console.log(borrado);

  // ── Verificación final ────────────────────────────────────────────────────
  const [quedanLic, quedanProv, quedanOC, quedanUsr] = await Promise.all([
    prisma.licitacion.count({ where: { numero: { startsWith: PREFIJO_LICITACION } } }),
    prisma.proveedor.count({ where: { razonSocial: { startsWith: PREFIJO_RAZON_SOCIAL } } }),
    prisma.ordenCompra.count({ where: { numero: { startsWith: PREFIJO_ORDEN } } }),
    prisma.usuario.count({ where: { email: { endsWith: DOMINIO_LOGIN_DEMO } } }),
  ]);
  const residuo = quedanLic + quedanProv + quedanOC + quedanUsr;

  const [provFin, licFin, ocFin, usrFin, prodFin] = await Promise.all([
    prisma.proveedor.count(),
    prisma.licitacion.count(),
    prisma.ordenCompra.count(),
    prisma.usuario.count(),
    prisma.producto.count(),
  ]);

  console.log("\n── VERIFICACIÓN ──");
  console.log(residuo === 0 ? "✓ No queda ningún dato con marcadores de demo" : `✗ Quedan ${residuo} filas marcadas`);
  const ok = (a: number, b: number) => (a === b ? "✓" : "✗ NO COINCIDE");
  console.log(`Proveedores:  ${provFin}/${provReales.length}  ${ok(provFin, provReales.length)}`);
  console.log(`Licitaciones: ${licFin}/${licReales.length}  ${ok(licFin, licReales.length)}`);
  console.log(`OC:           ${ocFin}/${ocReales.length}  ${ok(ocFin, ocReales.length)}`);
  console.log(`Usuarios:     ${usrFin}/${usuariosReales}  ${ok(usrFin, usuariosReales)}`);
  console.log(`Productos:    ${prodFin}  (nunca se tocaron)`);
  console.log(
    `\nContador de OC: se calcula con count()+1 (ordenesUtils.ts:45), así que al\n` +
      `borrar las dummy la numeración vuelve sola. La próxima OC real será OC-${String(ocFin + 1).padStart(4, "0")}.\n`
  );

  if (residuo !== 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("\n✗ ERROR en limpiar-demo:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
