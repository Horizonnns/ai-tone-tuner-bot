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
        description: `AI Tone Tuner Premium для пользователя ${telegramId}`,
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

// 🔔 Webhook от YooKassa !updated!
router.post("/webhook", async (req, res) => {
  try {
    const rawBody = req.body; // Buffer
    const bodyString = rawBody.toString("utf8");
    // log(`📬 Webhook raw body: ${bodyString}`);

    const rawHeaders = req.header;
    const headersString = rawHeaders.toString();
    log(`📬 Webhook headers: ${headersString}`);

    const event = JSON.parse(bodyString);

    if (event.event === "payment.succeeded") {
      const payment = event.object;
      const telegramId = event.object.metadata?.telegramId;

      // 👉 Сохраняем платеж в БД
      await prisma.payment.upsert({
        where: { paymentId: payment.id },
        update: { status: payment.status },
        create: {
          telegramId: String(telegramId),
          paymentId: payment.id,
          amount: Number(payment.amount.value),
          currency: payment.amount.currency,
          status: payment.status,
        },
      });

      if (telegramId) {
        await prisma.user.update({
          where: { telegramId: String(telegramId) },
          data: {
            isPremium: true,
            premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
          },
        });

        // Удаляем все ранее отправленные оффер-сообщения
        try {
          const offers = await (prisma as any).offerMessage.findMany({
            where: { telegramId: String(telegramId) },
          });
          for (const offer of offers) {
            try {
              await bot.telegram.deleteMessage(String(telegramId), offer.messageId);
            } catch {
              // пропускаем ошибки удаления (могло быть удалено вручную/истекло)
            }
          }
          await (prisma as any).offerMessage.deleteMany({
            where: { telegramId: String(telegramId) },
          });
        } catch {}

        // Отправляем сообщение пользователю
        await bot.telegram.sendMessage(
          telegramId,
          "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
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
