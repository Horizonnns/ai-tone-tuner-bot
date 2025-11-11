import express from "express";
import axios from "axios";
import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";

const router = express.Router();

// 🧾 Создание платежа
router.get("/create", async (req, res) => {
  const { telegramId } = req.query;

  try {
    const response = await axios.post(
      "https://api.yookassa.ru/v3/payments",
      {
        amount: { value: "199.00", currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${process.env.BACKEND_URL}/api/payments/success?telegramId=${telegramId}`,
        },
        capture: true,
        description: `AI Tone Writer Premium для пользователя ${telegramId}`,
        metadata: { telegramId }, // 👈 сохраняем ID в метаданные
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID!,
          password: process.env.YOOKASSA_SECRET!,
        },
        headers: {
          "Content-Type": "application/json",
          "Idempotence-Key": `${telegramId}-${Date.now()}`,
        },
      }
    );

    const confirmationUrl = response.data.confirmation.confirmation_url;
    log(`✅ Ссылка на оплату: ${confirmationUrl}`);
    res.redirect(confirmationUrl);
  } catch (error: any) {
    console.error("Ошибка при создании платежа:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ✅ После успешной оплаты (возврат из YooKassa)
router.get("/success", async (req, res) => {
  res.send(
    "✅ Оплата прошла успешно! Premium активируется в течение минуты — вернись в Telegram."
  );
});

// 🔔 Webhook от YooKassa
router.post("/webhook", express.json({ type: "application/json" }), async (req, res) => {
  try {
    const event = req.body;
    log(`📬 req: ${req}`);
    log(`📬 Webhook получен: ${event}`);

    if (event.event === "payment.succeeded") {
      const telegramId = event.object.metadata?.telegramId;

      if (telegramId) {
        const user = (await prisma.user.update({
          where: { telegramId: String(telegramId) },
          data: {
            isPremium: true,
            premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
          },
        })) as any;

        // Пытаемся удалить сообщение с предложением премиума, если оно было отправлено
        if (user.premiumOfferMessageId) {
          try {
            await bot.telegram.deleteMessage(
              String(telegramId),
              user.premiumOfferMessageId
            );
          } catch (e) {
            // Игнорируем ошибки удаления (сообщение могло быть уже удалено)
          } finally {
            // Чистим сохранённый message_id
            await prisma.user.update({
              where: { telegramId: String(telegramId) },
              // Каст к any, чтобы не зависеть от сгенерённых типов в рантайме
              data: { premiumOfferMessageId: null } as any,
            });
          }
        }

        // Отправляем сообщение пользователю
        await bot.telegram.sendMessage(
          telegramId,
          "🎉 Оплата прошла успешно!\n\n💎 *AI Tone Writer Premium* активирован на 30 дней.\nНаслаждайся безлимитом!",
          { parse_mode: "Markdown" }
        );

        log(`✅ Premium активирован для пользователя ${telegramId}`);
      }
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Ошибка при обработке webhook:", err.message);
    res.status(500).send("Error");
  }
});

export default router;
