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

dotenv.config();
const BACKEND_URL = process.env.BACKEND_URL;
setupInline(bot);

// 💎 Команда /premium — теперь с оплатой
bot.command("premium", async (ctx) => {
  const premiumUrl = buildPremiumUrl(ctx.from.id);
  await ctx.reply(premiumOfferText(premiumUrl), premiumReplyMarkup(premiumUrl));
});

async function getUser(telegramId: string) {
  const user = await getOrCreateUser(telegramId);
  return user;
}

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
        await bot.telegram.sendMessage(
          inviterId,
          `🎉 Твой друг ${ctx.from.first_name} присоединился по твоей ссылке!\nТы получил +2 попытки на сегодня 💪`
        );
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
Я *AI Tone Writer* — твой редактор настроения\\. 💫
Напиши текст, выбери стиль — и я сделаю его звучным\\!
Напиши, например:
_"Нужен React\\-разработчик"_`
  );

  log(`Пользователь ${ctx.from.id} запустил бота`);
});

// 💬 Принимаем текст
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  setUserMessage(ctx.from.id, text);

  await ctx.reply("Выбери стиль, в котором переписать:", {
    reply_markup: { inline_keyboard: buildToneKeyboard() },
  });
});

// ⚙️ Обработка выбора стиля
bot.action(/tone_(.+)/, async (ctx) => {
  const tone = ctx.match[1];
  const userId = ctx.from.id;
  const originalText = getUserMessage(userId);

  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}

  if (!originalText) {
    await ctx.reply("Отправь текст сначала 🙂");
    return;
  }

  const thinkingMsg = await ctx.reply("✨ Переписываю...");
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  try {
    const response = await axios.post(`${BACKEND_URL}/rewrite`, {
      text: originalText,
      tone,
      telegramId: String(userId),
    });

    const { result, remaining, initialLimit, isPremium, message } = response.data;

    if (isLimitError(response)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    let prefixMsg = "✨ Переписываю...";
    if (!isPremium && remaining !== "∞") {
      const totalLimit = initialLimit !== undefined ? initialLimit : 5;
      const used = totalLimit - remaining;
      prefixMsg += ` (${used}/${totalLimit} попыток на сегодня)`;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `${prefixMsg}\n\nВот твой текст в стиле *${toneLabel(tone)}*:\n\n${result}`,
      { parse_mode: "Markdown" }
    );

    const totalLimit = initialLimit !== undefined ? initialLimit : 5;
    const used = remaining !== "∞" ? totalLimit - remaining : 0;
    log(`User ${userId} rewrote text in ${tone} tone (${used}/${totalLimit})`);
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
});
