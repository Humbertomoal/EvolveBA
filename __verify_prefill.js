const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
const { chromium } = require("playwright");
require("dotenv").config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";
const LICITACION_ID = "cmqsi3rmf0000y0ke8qiq424w";
const PROVEEDOR_ID = "cmqrn38vc0000dske3labrm6h";

let originalState = null;
let createdOfertaId = null;

async function main() {
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: LICITACION_ID },
    include: { items: true },
  });
  originalState = {
    rondaActual: licitacion.rondaActual,
    esperandoDecision: licitacion.esperandoDecision,
    inicioRondaActual: licitacion.inicioRondaActual,
    duracionRondaMinutos: licitacion.duracionRondaMinutos,
  };
  console.log("original state:", JSON.stringify(originalState));

  const item1 = licitacion.items[0]; // cantidad 5
  console.log("item1 id:", item1.id, "cantidadSolicitada:", item1.cantidadSolicitada);

  // Ronda 1 oferta previa: precio 9.5, cantidad PARCIAL (3, menor a la solicitada 5),
  // no puede cumplir fecha, con fecha estimada.
  const created = await prisma.ofertaItem.create({
    data: {
      licitacionItemId: item1.id,
      proveedorId: PROVEEDOR_ID,
      ronda: 1,
      precioUnitario: 9.5,
      cantidadDisponible: 3,
      puedeCumplirFecha: false,
      fechaEstimadaEntrega: new Date("2026-08-15"),
    },
  });
  createdOfertaId = created.id;
  console.log("created ronda-1 oferta:", createdOfertaId);

  // Mover la licitación a "ronda 2 abierta, sin oferta aún en esta ronda"
  await prisma.licitacion.update({
    where: { id: LICITACION_ID },
    data: {
      rondaActual: 2,
      esperandoDecision: false,
      inicioRondaActual: new Date(),
      duracionRondaMinutos: 1440,
    },
  });
  console.log("licitacion movida a ronda 2 abierta");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("pageerror", (err) => console.log("[page error]", err.message));

  // Autenticarse como Admin (NextAuth) — el proxy exige sesión real.
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(500);

  // "Ver como" ese proveedor — mismo mecanismo que usa el TopBar real.
  await page.context().addCookies([
    {
      name: "cyrgo_proveedor_id",
      value: PROVEEDOR_ID,
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto(`http://localhost:3000/proveedor/licitaciones/${LICITACION_ID}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/prefill-ronda2.png`, fullPage: true });
  console.log("saved prefill-ronda2.png");

  await browser.close();
}

main()
  .catch((e) => console.error("SCRIPT ERROR:", e))
  .finally(async () => {
    // Restaurar todo, pase lo que pase
    if (originalState) {
      await prisma.licitacion.update({
        where: { id: LICITACION_ID },
        data: originalState,
      });
      console.log("licitacion restaurada:", JSON.stringify(originalState));
    }
    if (createdOfertaId) {
      await prisma.ofertaItem.delete({ where: { id: createdOfertaId } }).catch(() => {});
      console.log("oferta de prueba eliminada");
    }
    const remaining = await prisma.ofertaItem.count({
      where: { licitacionItem: { licitacionId: LICITACION_ID } },
    });
    console.log("ofertas restantes:", remaining);
    await prisma.$disconnect();
  });
