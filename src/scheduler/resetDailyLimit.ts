import cron from "node-cron";
import { prisma } from "../db/client";
import { log, logError } from "../utils/logger";

const CRON_SCHEDULE = "0 0 * * *"; // Каждый день в 00:00
const TIMEZONE = "Europe/Moscow";
const BASE_LIMIT = 5;
const REFERRAL_BONUS = 2; // +2 попытки за каждого реферала

/**
 * Вычисляет максимальный дневной лимит на основе количества рефералов
 * @param referralsCount - количество приглашенных рефералов
 * @returns максимальный дневной лимит
 */
function calculateDailyLimit(referralsCount: number): number {
  return BASE_LIMIT + referralsCount * REFERRAL_BONUS;
}

/**
 * Получает количество рефералов для каждого пользователя
 * @returns Map, где ключ - telegramId, значение - количество рефералов
 */
async function getReferralsCountMap(): Promise<Map<string, number>> {
  const referrals = await prisma.referral.groupBy({
    by: ["inviterId"],
    _count: { id: true },
  });

  return new Map(referrals.map((referral) => [referral.inviterId, referral._count.id]));
}

/**
 * Обновляет дневной лимит для одного пользователя
 */
async function updateUserDailyLimit(
  userId: number,
  telegramId: string,
  referralsCount: number
): Promise<void> {
  const newLimit = calculateDailyLimit(referralsCount);

  await prisma.user.update({
    where: { id: userId },
    data: { dailyLimit: newLimit },
  });
}

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
async function resetDailyLimit(): Promise<void> {
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

    // Получаем количество рефералов для каждого пользователя
    const referralsMap = await getReferralsCountMap();

    // Подготавливаем задачи обновления для всех пользователей
    const updateTasks = users
      .filter(
        (user): user is { id: number; telegramId: string } => user.telegramId !== null
      )
      .map((user) => {
        const referralsCount = referralsMap.get(user.telegramId) ?? 0;
        return updateUserDailyLimit(user.id, user.telegramId, referralsCount);
      });

    // Выполняем все обновления параллельно
    await Promise.all(updateTasks);

    const duration = Date.now() - startTime;
    log(
      `✅ Сброс лимитов завершён: обновлено ${users.length} пользователей (за ${duration}мс)`
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`❌ Ошибка при сбросе лимитов (за ${duration}мс): ${error}`);
    throw error;
  }
}

/**
 * Инициализирует планировщик для ежедневного сброса лимитов
 */
export function initScheduler(): void {
  cron.schedule(CRON_SCHEDULE, resetDailyLimit, { timezone: TIMEZONE });
  log("🕐 Планировщик запущен: ежедневный сброс dailyLimit в 00:00 (МСК)");
}

// Экспортируем функцию для ручного тестирования
export { resetDailyLimit };
