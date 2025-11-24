import { log } from "../utils/logger";
import { buildPremiumUrl, premiumReplyMarkup } from "../utils/telegram";
import { limitReachedText } from "../utils/texts";
import { prisma } from "../db/client";

export async function handleLimitReached(ctx: any, thinkingMsg: any, userId: number) {
  const premiumUrl = buildPremiumUrl(ctx.from.id);
  const userIdStr = String(userId);
  const messageText = limitReachedText(premiumUrl, userIdStr);
  const replyMarkup = premiumReplyMarkup(premiumUrl, userIdStr);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    thinkingMsg.message_id,
    undefined,
    messageText,
    replyMarkup ? { reply_markup: replyMarkup.reply_markup } : undefined
  );

  // Регистрируем это сообщение как оффер, чтобы удалить после оплаты
  try {
    await (prisma as any).offerMessage.create({
      data: {
        telegramId: String(userId),
        messageId: thinkingMsg.message_id as number,
      },
    });
  } catch {}

  log(`Пользователь ${userId} достиг лимита (403)`);
}

export function isLimitError(response?: any, error?: any): boolean {
  return (
    response?.status === 403 ||
    response?.data?.message?.includes("Достигнут лимит") ||
    error?.response?.status === 403
  );
}
