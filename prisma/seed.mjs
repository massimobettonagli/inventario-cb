import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.magazzino.upsert({
    where: { nome: "Treviolo" },
    update: {},
    create: { nome: "Treviolo" },
  });

  await prisma.magazzino.upsert({
    where: { nome: "Treviglio" },
    update: {},
    create: { nome: "Treviglio" },
  });

  console.log("✅ Seed completato: Treviolo, Treviglio");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });