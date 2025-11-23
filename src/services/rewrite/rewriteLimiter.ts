import { prisma } from "../../db/client";

export async function getUserLimits(telegramId: string) {
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) return { isPremium: false, limit: 5 };

  if (user.isPremium) {
    return { isPremium: true, limit: Infinity };
  }

  const referrals = await prisma.referral.count({ where: { inviterId: telegramId } });
  const baseLimit = 5 + referrals * 2;

  return { isPremium: false, limit: baseLimit, dailyLimit: user.dailyLimit };
}

export async function decrementUserLimit(telegramId: string) {
  return prisma.user.update({
    where: { telegramId },
    data: { dailyLimit: { decrement: 1 }, lastUsedAt: new Date() },
  });
}
