import cron from "node-cron";
import { prisma } from "../db/client";
import { log, logError } from "../utils/logger";

// Для тестирования можно использовать переменную окружения TEST_CRON_INTERVAL
// Например: TEST_CRON_INTERVAL="*/1 * * * *" для запуска каждую минуту
const cronSchedule = process.env.TEST_CRON_INTERVAL || "0 0 * * *";

async function resetDailyLimit() {
  const startTime = new Date();
  try {
    log(`🔄 Начало сброса дневных лимитов (${startTime.toISOString()})`);

    const result = await prisma.user.updateMany({
      data: { dailyLimit: 5 },
    });

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    log(
      `✅ Сброс лимитов завершён: обновлено ${result.count} пользователей ` +
        `(за ${duration}мс)`
    );
  } catch (error) {
    logError(`❌ Ошибка при сбросе лимитов: ${error}`);
  }
}

// Каждый день в 00:00 по серверному времени (или по TEST_CRON_INTERVAL для тестирования)
cron.schedule(cronSchedule, resetDailyLimit, { timezone: "Europe/Moscow" });

export function initScheduler() {
  const isTestMode = !!process.env.TEST_CRON_INTERVAL;
  const mode = isTestMode
    ? `ТЕСТОВЫЙ РЕЖИМ (${cronSchedule})`
    : "ежедневный сброс dailyLimit";
  log(`🕐 Планировщик запущен: ${mode}`);

  // Для тестирования запускаем сразу
  if (isTestMode) {
    log("🧪 Тестовый режим: выполняем первый запуск через 5 секунд...");
    setTimeout(() => {
      resetDailyLimit();
    }, 5000);
  }
}

// Экспортируем функцию для ручного тестирования
export { resetDailyLimit };
