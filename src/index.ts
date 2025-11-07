import "./bot/index"; // Подключаем остальной код бота
import dotenv from "dotenv";
import express from "express";
import paymentsRouter from "./routes/payments";
import { bot } from "./bot/instance";
import { log } from "./utils/logger";
import { router as rewriteRouter } from "./routes/rewrite";
import { initScheduler } from "./scheduler/resetDailyLimit";

dotenv.config();

const app = express();
app.use(express.json());

// Подключаем маршруты
app.use("/api", rewriteRouter);
app.use("/api/payments", paymentsRouter);

// Обработка webhook от Telegram
app.post("/api/webhook", async (req, res) => {
  try {
    await bot.handleUpdate(req.body); // передаём обновление в Telegraf
    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка при обработке webhook:", err);
    res.sendStatus(500);
  }
});

// Запускаем планировщик
initScheduler();

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  try {
    // Устанавливаем webhook Telegram на URL проекта Railway
    const webhookUrl = `https://${process.env.BACKEND_URL}/api/webhook`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`🤖 Webhook установлен: ${webhookUrl}`);

    // Запускаем бота
    await bot.launch();
    log("🤖 Telegram бот запущен!");
  } catch (err) {
    console.error("Ошибка при запуске бота:", err);
  }
});
