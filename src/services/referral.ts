import { prisma } from "../db/client";
import { log } from "../utils/logger";

export async function addReferral(inviterId: string, invitedId: string) {
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
    const existing = await prisma.referral.findFirst({
      where: { inviterId, invitedId },
    });
    if (existing) return;

    // создаём запись реферала
    await prisma.referral.create({ data: { inviterId, invitedId } });

    // добавляем +2 попытки
    await prisma.user.update({
      where: { telegramId: inviterId },
      data: { dailyLimit: { increment: 2 } },
    });

    log(`🎁 Referral: ${inviterId} пригласил ${invitedId} (+2 попытки)`);
  } catch (err: any) {
    log(`⚠️ Ошибка при добавлении реферала: ${err.message}`);
  }
}

export function generateReferralLink(telegramId: string) {
  const botUsername = process.env.BOT_USERNAME;
  return `https://t.me/${botUsername}?start=${telegramId}`;
}
