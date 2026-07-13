const { PrismaClient } = require(".prisma/client/default");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const IDS = [
  "cmrd63ph90000gokexds301jb",
  "cmrd63pjm0001gokeb5ais7lc",
  "cmrd63plp0002goked1ceqd2u",
  "cmrd63pns0003gokebbww8cp2",
  "cmrd63ppv0004goke78jqi21e",
  "cmrd63prx0005gokeqr64zjz5",
];

(async () => {
  const result = await prisma.ofertaItem.deleteMany({ where: { id: { in: IDS } } });
  console.log("deleted count:", result.count);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("CLEANUP ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
