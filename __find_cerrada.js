const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
(async () => {
  const rows = await prisma.licitacion.findMany({
    where: { estado: "Cerrada" },
    select: { id: true, numero: true },
  });
  console.log(JSON.stringify(rows));
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
