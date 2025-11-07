import cron from "node-cron";
import { prisma } from "../db/client";
import { log, logError } from "../utils/logger";

const CRON_SCHEDULE = "0 0 * * *"; // Каждый день в 00:00
const TIMEZONE = "Europe/Moscow";
const BASE_LIMIT = 5;
const REFERRAL_BONUS = 2; // +2 попытки за каждого реферала

/**
 * Сбрасывает дневные лимиты для всех пользователей
 *
 * Логика работы:
 * - Базовый лимит: 5 попыток
 * - За каждого приглашенного реферала: +2 попытки
 * - Пример: 3 реферала = 5 + (3 × 2) = 11 попыток в день
 *
 * При ежедневном сбросе каждый пользователь получает свой максимальный лимит
 * на основе количества приглашенных рефералов
 */
async function resetDailyLimit() {
  const startTime = Date.now();

  try {
    log("🔄 Начало сброса дневных лимитов");

    // Получаем всех пользователей с telegramId
    const users = await prisma.user.findMany({
      where: { telegramId: { not: null } },
      select: { id: true, telegramId: true },
    });

    if (users.length === 0) {
      log("ℹ️ Нет пользователей для обновления");
      return;
    }

    // Получаем количество рефералов для каждого пользователя одним запросом
    const referrals = await prisma.referral.groupBy({
      by: ["inviterId"],
      _count: { id: true },
    });

    // Создаем Map для быстрого доступа: telegramId -> количество рефералов
    const referralsMap = new Map(referrals.map((r) => [r.inviterId, r._count.id]));

    // Подготавливаем обновления для всех пользователей
    const updatePromises = users.map((user) => {
      if (!user.telegramId) return null;

      // Вычисляем максимальный лимит: базовый + реферальные бонусы
      const referralsCount = referralsMap.get(user.telegramId) || 0;
      const maxLimit = BASE_LIMIT + referralsCount * REFERRAL_BONUS;

      return prisma.user.update({
        where: { id: user.id },
        data: { dailyLimit: maxLimit },
      });
    });

    // Выполняем все обновления параллельно
    await Promise.all(updatePromises.filter(Boolean));

    const duration = Date.now() - startTime;
    log(
      `✅ Сброс лимитов завершён: обновлено ${users.length} пользователей (за ${duration}мс)`
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`❌ Ошибка при сбросе лимитов (за ${duration}мс): ${error}`);
  }
}

/**
 * Инициализирует планировщик для ежедневного сброса лимитов
 */
export function initScheduler() {
  cron.schedule(CRON_SCHEDULE, resetDailyLimit, { timezone: TIMEZONE });
  log("🕐 Планировщик запущен: ежедневный сброс dailyLimit в 00:00 (МСК)");
}

// Экспортируем функцию для ручного тестирования
export { resetDailyLimit };
