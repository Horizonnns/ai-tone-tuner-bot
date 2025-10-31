import { prisma } from "../db/client";

export async function getOrCreateUser(telegramId: string) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }
  return user;
}
