import { prisma } from "../db/client";
import { log } from "../utils/logger";

async function main(): Promise<void> {
  await prisma.user.updateMany({ data: { usageCount: 0 } });
  log("🔁 Разовый сброс лимитов завершён");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
