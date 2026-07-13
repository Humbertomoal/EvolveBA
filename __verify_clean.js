const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
(async () => {
  const count = await prisma.ofertaItem.count({ where: { licitacionItem: { licitacionId: "cmqsi3rmf0000y0ke8qiq424w" } } });
  console.log("remaining ofertas for test licitacion:", count);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
