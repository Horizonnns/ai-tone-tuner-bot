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

    // Получаем всех пользователей
    const users = await prisma.user.findMany();

    // Для каждого пользователя считаем его реферальные бонусы
    for (const user of users) {
      if (!user.telegramId) continue;

      const referralsCount = await prisma.referral.count({
        where: { inviterId: user.telegramId },
      });
      const newLimit = 5 + referralsCount * 2;

      await prisma.user.update({
        where: { id: user.id },
        data: { dailyLimit: newLimit },
      });
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    log(
      `✅ Сброс лимитов завершён: обновлено ${users.length} пользователей ` +
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
