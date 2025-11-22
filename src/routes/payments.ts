import { log } from "../utils/logger";
import express from "express";
import { yookassa } from "../services/yookassa/yookassa";

const router = express.Router();

// 🧾 Создание платежа
router.get("/create", async (req, res) => {
  const { telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  try {
    const payment = await yookassa.createPayment(
      {
        amount: { value: "199.00", currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${process.env.BACKEND_URL}/api/payments/success?telegramId=${telegramId}`,
        },
        description: `AI Tone Tuner Premium для пользователя ${telegramId}`,
        capture: true,
        metadata: { telegramId },
      },
      `${telegramId}-${Date.now()}`
    ); // Idempotence-Key

    const url = payment.confirmation.confirmation_url;
    log(`✅ Ссылка на оплату: ${url}`);
    res.redirect(url);
  } catch (err: any) {
    console.error("Ошибка при создании платежа:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ После успешной оплаты (возврат из YooKassa)
router.get("/success", async (_req, res) => {
  res.send("✅ Оплата прошла успешно! Premium активируется в течение минуты.");
});

export default router;
