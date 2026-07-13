const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
(async () => {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: "cmqrn38vc0000dske3labrm6h" },
    include: { usuario: true },
  });
  console.log(JSON.stringify(proveedor, null, 2));
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
