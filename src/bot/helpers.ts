import { log } from "../utils/logger";
import { buildPremiumUrl, premiumReplyMarkup } from "../utils/telegram";
import { prisma } from "../db/client";

export async function handleLimitReached(ctx: any, thinkingMsg: any, userId: number) {
  const premiumUrl = buildPremiumUrl(ctx.from.id);
  const messageText =
    "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
    "💎 Хочешь без ограничений и новых стилей? Подключи Premium ✨" +
    (premiumReplyMarkup(premiumUrl) ? "" : `\n\nСсылка для оплаты: ${premiumUrl}`);

  const replyMarkup = premiumReplyMarkup(premiumUrl);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    thinkingMsg.message_id,
    undefined,
    messageText,
    replyMarkup ? { reply_markup: replyMarkup.reply_markup } : undefined
  );

  // Сохраняем id сообщения с предложением премиума, чтобы удалить после оплаты
  try {
    await prisma.user.update({
      where: { telegramId: String(userId) },
      data: { premiumOfferMessageId: thinkingMsg.message_id } as any,
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
