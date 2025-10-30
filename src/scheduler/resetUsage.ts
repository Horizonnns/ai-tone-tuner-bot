import cron from "node-cron";
import { prisma } from "../db/client";
import { log } from "../utils/logger";

// Каждый день в 00:00 по серверному времени
cron.schedule("0 0 * * *", async () => {
  await prisma.user.updateMany({
    data: { usageCount: 0 },
  });
  log("🔁 Ежедневный сброс лимитов завершён");
});

export function initScheduler() {
  log("🕐 Планировщик запущен (ежедневный сброс лимитов)");
}
