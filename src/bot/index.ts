import { Telegraf, Markup } from "telegraf";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// Простая память: userId -> lastMessage
const userMessages = new Map<number, string>();

// 🧠 Новое: лимиты пользователей
const userLimits = new Map<number, { count: number; lastDate: string }>();

// 👋 /start
bot.start((ctx) => {
  ctx.replyWithMarkdownV2(
    `Привет, ${ctx.from.first_name}\\! 👋
Я *AI Tone Writer* — твой редактор настроения\\. 💫
Напиши текст, выбери стиль — и я сделаю его звучным\\!
Напиши, например:
_"Нужен React\\-разработчик"_`
  );
});

// 💬 Основной обработчик текста
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  // Сохраняем текст
  userMessages.set(ctx.from.id, text);

  ctx.reply(
    "Выбери стиль, в котором переписать:",
    Markup.inlineKeyboard([
      [Markup.button.callback("💼 Деловой", "tone_business")],
      [Markup.button.callback("💬 Дружелюбный", "tone_friendly")],
      [Markup.button.callback("🚀 Хайповый", "tone_hype")],
      [Markup.button.callback("✨ Вдохновляющий", "tone_inspire")],
    ])
  );

  (ctx as any).session = { text };
});

// ⚙️ Обработка выбора стиля
bot.action(/tone_(.+)/, async (ctx) => {
  const tone = ctx.match[1];
  const userId = ctx.from.id;
  const today = new Date().toISOString().slice(0, 10);
  const userLimit = userLimits.get(userId);

  // 🧩 Проверяем лимит ДО удаления клавиатуры
  const isLimited =
    userLimit && userLimit.lastDate === today && userLimit.count >= 5;

  // Удаляем клавиатуру (в любом случае)
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}

  const originalText = userMessages.get(userId);
  if (!originalText) {
    await ctx.reply("Отправь текст сначала 🙂");
    return;
  }

  // 💫 Отображаем "переписываю..."
  const thinkingMsg = await ctx.reply("✨ Переписываю...");
  await ctx.telegram.sendChatAction(ctx.chat.id, "typing");

  // 🚧 Если лимит достигнут — показываем сообщение вместо генерации
  if (isLimited) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      "😅 Ты достиг лимита в 5 преобразований на сегодня.\n\n" +
        "Хочешь без ограничений? 💎 Скоро будет подписка AI Tone Writer Premium!"
    );
    return;
  }

  // 📊 Обновляем или создаём счётчик
  if (!userLimit || userLimit.lastDate !== today) {
    userLimits.set(userId, { count: 1, lastDate: today });
  } else {
    userLimit.count += 1;
    userLimits.set(userId, userLimit);
  }

  const toneMap: Record<string, string> = {
    business: "деловой профессиональный стиль",
    friendly: "дружелюбный лёгкий тон",
    hype: "современный, эмоциональный и хайповый стиль",
    inspire: "вдохновляющий",
  };

  // 🧠 Генерация текста
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Ты помощник, который переписывает текст в заданном тоне.`,
      },
      {
        role: "user",
        content: `Перепиши следующий текст в ${toneMap[tone]}:\n\n${originalText}`,
      },
    ],
  });

  const result =
    completion.choices[0].message?.content || "Что-то пошло не так 😅";

  // ✏️ Заменяем сообщение “Переписываю...” на результат
  await ctx.telegram.editMessageText(
    ctx.chat.id,
    thinkingMsg.message_id,
    undefined,
    `Вот твой текст в стиле *${toneMap[tone]}*:\n\n${result}`,
    { parse_mode: "Markdown" }
  );

  userMessages.delete(userId);
});

// 🚀 Запуск
bot.launch();
console.log("🤖 Telegram бот запущен!");
