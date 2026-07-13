const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LICITACION_ID = "cmqsi3rmf0000y0ke8qiq424w";

(async () => {
  const licitacion = await prisma.licitacion.findUnique({
    where: { id: LICITACION_ID },
    include: { items: true, proveedoresInvitados: { include: { proveedor: true } } },
  });
  console.log("items:", licitacion.items.map((i) => i.id));
  console.log("proveedores:", licitacion.proveedoresInvitados.map((p) => p.proveedor.id));

  const proveedorId = licitacion.proveedoresInvitados[0].proveedor.id;
  const [item1, item2] = licitacion.items;

  const created = await prisma.$transaction([
    prisma.ofertaItem.create({
      data: { licitacionItemId: item1.id, proveedorId, ronda: 1, precioUnitario: 12, cantidadDisponible: 5 },
    }),
    prisma.ofertaItem.create({
      data: { licitacionItemId: item2.id, proveedorId, ronda: 1, precioUnitario: 11, cantidadDisponible: 4 },
    }),
    prisma.ofertaItem.create({
      data: { licitacionItemId: item1.id, proveedorId, ronda: 2, precioUnitario: 9, cantidadDisponible: 5 },
    }),
    prisma.ofertaItem.create({
      data: { licitacionItemId: item2.id, proveedorId, ronda: 2, precioUnitario: 8, cantidadDisponible: 4 },
    }),
    prisma.ofertaItem.create({
      data: { licitacionItemId: item1.id, proveedorId, ronda: 3, precioUnitario: 8.5, cantidadDisponible: 5 },
    }),
    prisma.ofertaItem.create({
      data: { licitacionItemId: item2.id, proveedorId, ronda: 3, precioUnitario: 7.5, cantidadDisponible: 4 },
    }),
  ]);
  console.log("created ids:", created.map((c) => c.id));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("SEED ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
