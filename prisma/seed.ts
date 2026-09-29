// Seed idempotente. Siempre importa la biblioteca base; los datos de demostración
// solo se crean con SEED_DEMO=true y la base sin usuarios.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importCatalog } from "./seed/catalog";
import { seedDemo } from "./seed/demo";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const catalog = await importCatalog(prisma);
  console.log(`Biblioteca: ${catalog.planilla} ejercicios de la planilla, ${catalog.dataset} nuevos del catálogo base.`);
  if (process.env.SEED_DEMO === "true") {
    const demo = await seedDemo(prisma);
    console.log(demo.skipped ? "Demo omitida: la base ya tiene usuarios." : `Demo creada: ${demo.coach} y ${demo.athlete}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
