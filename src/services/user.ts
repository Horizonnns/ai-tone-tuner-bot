import { prisma } from "../db/client";

export async function getOrCreateUser(telegramId: string) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }
  return user;
}

export async function incrementUsage(telegramId: string) {
  const user = await getOrCreateUser(telegramId);
  if (user.isPremium) return true;

  if (user.usageCount >= 5) return false;

  await prisma.user.update({
    where: { telegramId },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
  return true;
}
