import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/create", async (req, res) => {
  const { telegramId } = req.query;

  try {
    const response = await axios.post(
      "https://api.yookassa.ru/v3/payments",
      {
        amount: { value: "99.00", currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${process.env.BASE_URL}/api/payments/success?telegramId=${telegramId}`,
        },
        capture: true,
        description: `AI Tone Writer Premium для пользователя ${telegramId}`,
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
    console.log("✅ Ссылка на оплату:", confirmationUrl);
    res.redirect(confirmationUrl);
  } catch (error: any) {
    console.error("Ошибка при создании платежа:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

router.get("/success", async (req, res) => {
  res.send("✅ Оплата прошла успешно! Вернись в Telegram — Premium уже активирован.");
});

export default router;
