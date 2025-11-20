import { log } from "../utils/logger";
import axios from "axios";
import express from "express";

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

export default router;
