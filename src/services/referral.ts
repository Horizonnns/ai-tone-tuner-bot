import { prisma } from "../db/client";
import { log } from "../utils/logger";

/**
 * Добавляет реферала и начисляет +2 попытки пригласившему
 * @returns true если реферал был создан, false если уже существовал
 */
export async function addReferral(
  inviterId: string,
  invitedId: string
): Promise<boolean> {
  try {
    // создаём обоих, если ещё нет
    const inviter = await prisma.user.upsert({
      where: { telegramId: inviterId },
      update: {},
      create: { telegramId: inviterId },
    });

    const invited = await prisma.user.upsert({
      where: { telegramId: invitedId },
      update: {},
      create: { telegramId: invitedId },
    });

    // проверяем, не был ли уже приглашён
    const existing = await prisma.referral.findFirst({ where: { inviterId, invitedId } });

    if (existing) {
      log(`⚠️ Referral уже существует: ${inviterId} → ${invitedId}`);
      return false;
    }

    // создаём запись реферала
    await prisma.referral.create({ data: { inviterId, invitedId } });

    // Для премиум-пользователей не начисляем попытки (у них безлимит)
    if (inviter.isPremium) {
      log(`🎁 Referral: ${inviterId} (Premium) пригласил ${invitedId}`);
      return true;
    }

    // Вычисляем максимальный допустимый лимит: базовый (5) + реферальные бонусы
    // Подсчитываем общее количество рефералов пригласившего
    const totalReferrals = await prisma.referral.count({ where: { inviterId } });
    const maxAllowedLimit = 5 + totalReferrals * 2;

    // Получаем текущий лимит пользователя
    const currentLimit = inviter.dailyLimit;

    // Добавляем +2 попытки, но не превышаем максимальный лимит
    const newLimit = Math.min(currentLimit + 2, maxAllowedLimit);
    const actualIncrement = newLimit - currentLimit;

    if (actualIncrement > 0) {
      await prisma.user.update({
        where: { telegramId: inviterId },
        data: { dailyLimit: newLimit },
      });

      log(
        `🎁 Referral: ${inviterId} пригласил ${invitedId} (+${actualIncrement} попыток, лимит: ${newLimit}/${maxAllowedLimit})`
      );
    } else {
      log(
        `⚠️ Referral: ${inviterId} пригласил ${invitedId}, но лимит уже на максимуме (${currentLimit}/${maxAllowedLimit})`
      );
    }

    return true;
  } catch (err: any) {
    log(`⚠️ Ошибка при добавлении реферала: ${err.message}`);
    return false;
  }
}

export function generateReferralLink(telegramId: string) {
  const botUsername = process.env.BOT_USERNAME;
  return `https://t.me/${botUsername}?start=${telegramId}`;
}
