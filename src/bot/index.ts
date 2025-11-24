import dotenv from "dotenv";
import { Markup } from "telegraf";
import { bot } from "../bot/instance";
import { prisma } from "../db/client";
import { log } from "../utils/logger";
import { setupInline } from "./inline";
import { premiumOfferText } from "../utils/texts";
import { getOrCreateUser } from "../services/user";
import { i18n, userLang, TLang } from "../locales/index";
import { handleRewriteRequest } from "./services/rewriteService";
import { buildPremiumUrl, premiumReplyMarkup } from "../utils/telegram";
import { addReferral, generateReferralLink } from "../services/referral";
import { setUserMessage, getUserMessage } from "../services/messageCache";
import { toneLabel, buildToneKeyboard, TONE_SELECTION_TEXT } from "./tones";
import {
  isAwaitingCustomTone,
  setAwaitingCustomTone,
  clearAwaitingCustomTone,
} from "../services/userState";

dotenv.config();
setupInline(bot);

async function getUser(telegramId: string) {
  const user = await getOrCreateUser(telegramId);
  return user;
}

// Команда /language — для выбора языка
bot.command("language", async (ctx) => {
  const userId = ctx.from.id.toString();
  const currentLang = userLang.get(userId) || "ru";
  const t = i18n[currentLang];

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("🇷🇺 Русский", "lang_ru"),
      Markup.button.callback("🇹🇯 Тоҷикӣ", "lang_tj"),
    ],
    [
      Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"),
      Markup.button.callback("🇰🇿 Қазақша", "lang_kz"),
    ],
  ]);

  await ctx.reply(t.choose_language, keyboard);
});

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
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("🇷🇺 Русский", "lang_ru"),
      Markup.button.callback("🇹🇯 Тоҷикӣ", "lang_tj"),
    ],
    [
      Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"),
      Markup.button.callback("🇰🇿 Қазақша", "lang_kz"),
    ],
  ]);

  await ctx.reply(
    "Выберите язык / Забонро интихоб кунед / Tilni tanlang / Тілді таңдаңыз",
    keyboard
  );

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

  //   await ctx.replyWithMarkdownV2(
  //     `Привет, ${ctx.from.first_name}\\! 👋
  // Я *AI Tone Tuner* — твой редактор настроения\\. 💫
  // Напиши текст, выбери стиль — и я сделаю его звучным\\!
  // Напиши, например:
  // _"Нужен React\\-разработчик"_`
  //   );

  // const link = generateReferralLink(userId);

  //   await ctx.reply(
  //     "Поделись ссылкой с друзьями и получи +2 попытки за каждого! 🎁",

  //     Markup.inlineKeyboard([
  //       Markup.button.url(
  //         "📤 Поделится",
  //         `https://t.me/share/url?url=${encodeURIComponent(link)}`
  //       ),
  //     ])
  //   );

  //   log(`Пользователь ${ctx.from.id} запустил бота`);
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

    await handleRewriteRequest(ctx, originalText, tone, userId, tone);
    return;
  }

  setUserMessage(userId, text);

  const telegramId = String(ctx.from.id);
  // Редактируем сообщение пользователя, заменяя его на сообщение с клавиатурой
  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.message.message_id,
      undefined,
      TONE_SELECTION_TEXT,
      { reply_markup: { inline_keyboard: buildToneKeyboard("collapsed", false) } }
    );
    // Сохраняем id сообщения с клавиатурой, чтобы удалить после выбора стиля
    try {
      await (prisma as any).offerMessage.create({
        data: {
          telegramId,
          messageId: ctx.message.message_id,
        },
      });
    } catch {}
  } catch (err) {
    // Если не удалось отредактировать, отправляем новое сообщение
    const sentStyle = await ctx.reply(TONE_SELECTION_TEXT, {
      reply_markup: { inline_keyboard: buildToneKeyboard("collapsed", false) },
    });
    try {
      if (sentStyle && typeof sentStyle === "object" && "message_id" in sentStyle) {
        await (prisma as any).offerMessage.create({
          data: {
            telegramId,
            messageId: (sentStyle as any).message_id as number,
          },
        });
      }
    } catch {}
  }
});

// Обработчик заголовка (ничего не делает, просто отвечает на callback)
bot.action("tone_header", async (ctx) => {
  await ctx.answerCbQuery();
});

bot.action(/lang_(.+)/, async (ctx) => {
  const lang = ctx.match[1] as TLang;
  const userId = ctx.from.id.toString();

  userLang.set(userId, lang);
  const t = i18n[lang];
  await ctx.editMessageText(t.greeting(ctx.from.first_name), {
    parse_mode: "MarkdownV2",
  });

  const link = generateReferralLink(userId);

  // После приветствия можно показать дальнейшие кнопки
  await ctx.reply(
    t.invite,
    Markup.inlineKeyboard([
      Markup.button.url(
        `📤 ${t.share}`,
        `https://t.me/share/url?url=${encodeURIComponent(link)}`
      ),
    ])
  );

  log(`Пользователь ${ctx.from.id} запустил бота`);
});

// ⚙️ Обработка выбора стиля
bot.action(
  /^(?:tone_(business|friendly|hype|inspire|persuasive|humorous))$/,
  async (ctx) => {
    const tone = ctx.match[1];
    const userId = ctx.from.id;
    const telegramId = String(userId);
    const originalText = getUserMessage(userId);

    try {
      // Удаляем сообщение с клавиатурой из базы данных
      const keyboardMessages = await (prisma as any).offerMessage.findMany({
        where: { telegramId },
      });
      for (const msg of keyboardMessages) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, msg.messageId);
        } catch {
          // пропускаем ошибки удаления (могло быть удалено вручную/истекло)
        }
      }
      await (prisma as any).offerMessage.deleteMany({ where: { telegramId } });
    } catch {}

    if (!originalText) {
      await ctx.reply("Отправь текст сначала 🙂");
      return;
    }

    await handleRewriteRequest(ctx, originalText, tone, userId, toneLabel(tone));
  }
);

bot.action("tone_custom", async (ctx) => {
  const userId = ctx.from.id;
  const telegramId = String(userId);

  try {
    // Удаляем сообщение с клавиатурой из базы данных
    const keyboardMessages = await (prisma as any).offerMessage.findMany({
      where: { telegramId },
    });
    for (const msg of keyboardMessages) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.messageId);
      } catch {
        // пропускаем ошибки удаления (могло быть удалено вручную/истекло)
      }
    }
    await (prisma as any).offerMessage.deleteMany({
      where: { telegramId },
    });
  } catch {}

  setAwaitingCustomTone(userId, true);
  await ctx.reply(
    "Напиши стиль/тон, в котором переписать (пример: 'лаконичный официальный')"
  );
});

bot.action("tone_more", async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: buildToneKeyboard("expanded", false),
    });
  } catch {}
});

// Свернуть дополнительные тона
bot.action("tone_less", async (ctx) => {
  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: buildToneKeyboard("collapsed", false),
    });
  } catch {}
});
