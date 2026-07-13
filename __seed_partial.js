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
  const proveedorId = licitacion.proveedoresInvitados[0].proveedor.id;
  const [item1] = licitacion.items;

  // Solo UNA puja parcial (solo item1, solo ronda 1) — el otro material sigue sin ofertas.
  const created = await prisma.ofertaItem.create({
    data: { licitacionItemId: item1.id, proveedorId, ronda: 1, precioUnitario: 9.5, cantidadDisponible: 5 },
  });
  console.log("created id:", created.id);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("SEED ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
