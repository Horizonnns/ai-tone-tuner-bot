import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import { log, logError } from "../utils/logger";
import { setupInline } from "./inline";
import { setupPremium } from "./premium";
import { addReferral, generateReferralLink } from "../services/referral";
import { prisma } from "../db/client";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const API_URL = process.env.API_URL || "http://localhost:4000/api/rewrite";

setupInline(bot);
setupPremium(bot);

// Простая память для последних сообщений
const userMessages = new Map<number, string>();

// 🧩 Вспомогательная функция получения юзера
async function getUser(telegramId: string) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
    log(`Создан новый пользователь: ${telegramId}`);
  }
  return user;
}

// 👋 /start
bot.start(async (ctx) => {
  const args = ctx.message.text.split(" ");
  const inviterId = args[1];
  const userId = ctx.from.id.toString();

  // Добавляем в базу нового пользователя
  await getUser(userId);

  // Реферальная логика
  if (inviterId && inviterId !== userId) {
    await addReferral(inviterId, userId);
  }

  const link = generateReferralLink(userId);

  await ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
      `Поделись этой ссылкой с друзьями и получи +2 попытки за каждого: ${link}`
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
  userMessages.set(ctx.from.id, text);

  await ctx.reply(
    "Выбери стиль, в котором переписать:",
    Markup.inlineKeyboard([
      [Markup.button.callback("💼 Деловой", "tone_business")],
      [Markup.button.callback("💬 Дружелюбный", "tone_friendly")],
      [Markup.button.callback("🚀 Хайповый", "tone_hype")],
      [Markup.button.callback("✨ Вдохновляющий", "tone_inspire")],
    ])
  );
});

// ⚙️ Обработка выбора стиля
bot.action(/tone_(.+)/, async (ctx) => {
  const tone = ctx.match[1];
  const userId = ctx.from.id;
  const originalText = userMessages.get(userId);

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
    const response = await axios.post(API_URL, {
      text: originalText,
      tone,
      telegramId: String(userId),
    });

    const { result, usageCount, isPremium, message } = response.data;

    if (response.status === 403 || message?.includes("Достигнут лимит")) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        undefined,
        "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
          "💎 Хочешь без ограничений? Подписка AI Tone Writer Premium — скоро!"
      );
      log(`Пользователь ${userId} достиг лимита (403)`);
      return;
    }

    let prefixMsg = "✨ Переписываю...";
    if (!isPremium && usageCount !== "∞") {
      prefixMsg += ` (${usageCount}/5 попыток на сегодня)`;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `${prefixMsg}\n\nВот твой текст в стиле *${toneLabel(tone)}*:\n\n${result}`,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in ${tone} tone (${usageCount}/5)`);
    userMessages.delete(userId);
  } catch (err: any) {
    logError(`Ошибка при переписывании: ${err.message}`);
    if (err.response?.status === 403) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        undefined,
        "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪"
      );
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

// 🎨 Словарь стилей
function toneLabel(key: string) {
  const map: Record<string, string> = {
    business: "💼 деловой профессиональный стиль",
    friendly: "💬 дружелюбный лёгкий тон",
    hype: "🚀 современный и хайповый стиль",
    inspire: "✨ вдохновляющий стиль",
  };
  return map[key] || key;
}

// 🚀 Запуск
bot.launch();
console.log("🤖 Telegram бот запущен!");
log("Бот успешно запущен");
