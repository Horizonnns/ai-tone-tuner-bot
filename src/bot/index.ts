import { Markup } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import { log, logError } from "../utils/logger";
import { setupInline } from "./inline";
import { toneLabel, buildToneKeyboard } from "./tones";

import { addReferral, generateReferralLink } from "../services/referral";
import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { getOrCreateUser } from "../services/user";
import { buildPremiumUrl, premiumReplyMarkup } from "../utils/telegram";
import { premiumOfferText } from "../utils/texts";
import { handleLimitReached, isLimitError } from "./helpers";
import {
  setUserMessage,
  getUserMessage,
  deleteUserMessage,
} from "../services/messageCache";
import {
  isAwaitingCustomTone,
  setAwaitingCustomTone,
  clearAwaitingCustomTone,
} from "../services/userState";

dotenv.config();
const BACKEND_URL = process.env.BACKEND_URL;
setupInline(bot);

async function getUser(telegramId: string) {
  const user = await getOrCreateUser(telegramId);
  return user;
}

// 🔄 Общая функция для переписывания текста
async function rewriteText(
  ctx: any,
  originalText: string,
  tone: string,
  userId: number,
  toneDisplayName: string
) {
  const thinkingMsg = await ctx.reply("✨");

  try {
    const response = await axios.post(`${BACKEND_URL}/api/rewrite`, {
      text: originalText,
      tone,
      telegramId: String(userId),
    });

    const { result, remaining, initialLimit, isPremium } = response.data;

    if (isLimitError(response)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    const totalLimit = initialLimit !== undefined ? initialLimit : 5;
    const used = remaining !== "∞" ? totalLimit - remaining : 0;
    const attemptsInfo =
      !isPremium && remaining !== "∞"
        ? `\n\n_${used}/${totalLimit} попыток на сегодня_`
        : "";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `Вот твой текст в стиле *${toneDisplayName}*:\n\n${result}${attemptsInfo}`,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in tone "${tone}" (${used}/${totalLimit})`);
    deleteUserMessage(userId);
  } catch (err: any) {
    logError(`Ошибка при переписывании: ${err.message}`);

    if (isLimitError(undefined, err)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      "⚠️ Что-то пошло не так. Попробуй ещё раз позже!"
    );
  }
}

// 💎 Команда /premium — теперь с оплатой
bot.command("premium", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const user = await getOrCreateUser(telegramId);

  if (user.isPremium) {
    const until = user.premiumUntil
      ? new Date(user.premiumUntil).toLocaleDateString("ru-RU")
      : undefined;
    await ctx.reply(
      until
        ? `💎 У тебя уже есть Premium ✨\nАктивен до: ${until}`
        : "💎 У тебя уже есть Premium✨"
    );
    return;
  }

  const premiumUrl = buildPremiumUrl(ctx.from.id);
  const sent = await ctx.reply(
    premiumOfferText(premiumUrl),
    premiumReplyMarkup(premiumUrl)
  );
  // Сохраняем id сообщения предложения, чтобы удалить после оплаты
  try {
    if (sent && typeof sent === "object" && "message_id" in sent) {
      await (prisma as any).offerMessage.create({
        data: {
          telegramId,
          messageId: (sent as any).message_id as number,
        },
      });
    }
  } catch {}
});

bot.start(async (ctx) => {
  const args = ctx.message.text.split(" ");
  const inviterId = args[1];
  const userId = ctx.from.id.toString();

  // Добавляем в базу нового пользователя
  await getUser(userId);

  // Реферальная логика
  if (inviterId && inviterId !== userId) {
    await getUser(inviterId);
    const referralCreated = await addReferral(inviterId, userId);

    // Отправляем уведомление только если реферал был создан впервые
    if (referralCreated) {
      const inviter = await prisma.user.findUnique({ where: { telegramId: inviterId } });
      if (inviter) {
        if (!inviter.isPremium) {
          // Для обычных пользователей отправляем сообщение с информацией о попытках
          await bot.telegram.sendMessage(
            inviterId,
            `🎉 Твой друг ${ctx.from.first_name} присоединился по твоей ссылке!\nТы получил +2 попытки на сегодня 💪`
          );
        }
      }
    }
  }

  const link = generateReferralLink(userId);

  await ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
      `Поделись ссылкой с друзьями и получи +2 попытки за каждого!`,

    Markup.inlineKeyboard([
      Markup.button.url(
        "📤 Поделится",
        `https://t.me/share/url?url=${encodeURIComponent(link)}`
      ),
    ])
  );

  await ctx.replyWithMarkdownV2(
    `Привет, ${ctx.from.first_name}\\! 👋
Я *AI Tone Tuner* — твой редактор настроения\\. 💫
Напиши текст, выбери стиль — и я сделаю его звучным\\!
Напиши, например:
_"Нужен React\\-разработчик"_`
  );

  log(`Пользователь ${ctx.from.id} запустил бота`);
});

// 💬 Принимаем текст
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  if (isAwaitingCustomTone(userId)) {
    const originalText = getUserMessage(userId);
    const tone = text.trim();

    clearAwaitingCustomTone(userId);

    if (!originalText) {
      await ctx.reply("Сначала отправь текст, затем выбери стиль 🙂");
      return;
    }

    await rewriteText(ctx, originalText, tone, userId, tone);
    return;
  }

  setUserMessage(userId, text);
  await ctx.reply("Выбери стиль, в котором переписать:", {
    reply_markup: { inline_keyboard: buildToneKeyboard("collapsed") },
  });
});

// ⚙️ Обработка выбора стиля
bot.action(
  /^(?:tone_(business|friendly|hype|inspire|persuasive|humorous))$/,
  async (ctx) => {
    const tone = ctx.match[1];
    const userId = ctx.from.id;
    const originalText = getUserMessage(userId);

    try {
      await ctx.deleteMessage();
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {}

    if (!originalText) {
      await ctx.reply("Отправь текст сначала 🙂");
      return;
    }

    await rewriteText(ctx, originalText, tone, userId, toneLabel(tone));
  }
);

bot.action("tone_custom", async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.deleteMessage();
  } catch {}
  setAwaitingCustomTone(ctx.from.id, true);
  await ctx.reply(
    "Напиши стиль/тон, в котором переписать (пример: 'лаконичный официальный')"
  );
});

bot.action("tone_more", async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: buildToneKeyboard("expanded") });
  } catch {}
});

// Свернуть дополнительные тона
bot.action("tone_less", async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: buildToneKeyboard("collapsed") });
  } catch {}
});
