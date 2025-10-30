import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import { log } from "../utils/logger";
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const API_URL = process.env.API_URL || "http://localhost:4000/api/rewrite";

// Простая память для последних сообщений
const userMessages = new Map<number, string>();

// 👋 /start
bot.start(async (ctx) => {
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

  // Удаляем кнопки после выбора
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}

  if (!originalText) {
    await ctx.reply("Отправь текст сначала 🙂");
    return;
  }

  // Показать “переписываю...”
  const thinkingMsg = await ctx.reply("✨ Переписываю...");
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  try {
    const response = await axios.post(API_URL, {
      text: originalText,
      tone,
      telegramId: String(userId),
    });

    if (
      response.status === 403 ||
      response.data?.message?.includes("Достигнут лимит")
    ) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        undefined,
        "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
          "💎 Хочешь без ограничений? Подписка AI Tone Writer Premium — скоро!"
      );
      log(`Пользователь ${userId} достиг лимита (403).`);
      return;
    }

    const result = response.data.result;
    const usageCount = response.data.usageCount ?? "?";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `✨ Переписываю... (${usageCount}/5 попыток на сегодня)\n\n` +
        `Вот твой текст в стиле *${toneLabel(tone)}*:\n\n${result}`,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in ${tone} tone (${usageCount}/5)`);

    userMessages.delete(userId);
  } catch (err: any) {
    console.error(err);

    // если сервер прислал 403, отразим красиво
    if (
      err.response?.status === 403 &&
      err.response?.data?.message?.includes("Достигнут лимит")
    ) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        undefined,
        "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪"
      );
      log(`Пользователь ${userId} достиг лимита (catch)`);
      return;
    }

    // иначе — общая ошибка
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      "⚠️ Что-то пошло не так. Попробуй ещё раз позже!"
    );
  }

  // try {
  //   // Запрос к API
  //   const response = await axios.post(API_URL, {
  //     text: originalText,
  //     tone,
  //     telegramId: String(userId),
  //   });

  //   if (response.data?.error) {
  //     throw new Error(response.data.error);
  //   }

  //   if (response.data?.message?.includes("Достигнут лимит")) {
  //     await ctx.telegram.editMessageText(
  //       ctx.chat.id,
  //       thinkingMsg.message_id,
  //       undefined,
  //       "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
  //         "💎 Хочешь без ограничений? Подписка AI Tone Writer Premium — скоро!"
  //     );
  //     log(`Пользователь ${userId} достиг лимита.`);
  //     return;
  //   }

  //   const result = response.data.result;
  //   const usageCount = response.data.usageCount ?? "?";

  //   await ctx.telegram.editMessageText(
  //     ctx.chat.id,
  //     thinkingMsg.message_id,
  //     undefined,
  //     `✨ Переписываю... (${usageCount}/5 попыток на сегодня)\n\n` +
  //       `Вот твой текст в стиле *${toneLabel(tone)}*:\n\n${result}`,
  //     { parse_mode: "Markdown" }
  //   );

  //   log(`User ${userId} rewrote text in ${tone} tone (${usageCount}/5)`);

  //   userMessages.delete(userId);
  // } catch (err: any) {
  //   console.error(err);
  //   await ctx.telegram.editMessageText(
  //     ctx.chat.id,
  //     thinkingMsg.message_id,
  //     undefined,
  //     "⚠️ Что-то пошло не так. Попробуй ещё раз позже!"
  //   );
  // }
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
