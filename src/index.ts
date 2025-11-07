import "./bot/index"; // <- важно, чтобы бот подключился
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

// Запускаем планировщик
initScheduler();
const PORT = process.env.PORT || 4000;

// Запуск Express
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Запуск бота
// bot.launch();
// log("🤖 Telegram бот запущен!");

// Запуск Express
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  if (process.env.NODE_ENV === "production") {
    const webhookUrl = `${process.env.BACKEND_URL}/webhook`;
    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
    } catch (err) {
      console.error("❌ Ошибка установки webhook:", err);
    }
  } else {
    bot.launch();
    console.log("🤖 Бот запущен в режиме разработки (polling)");
  }
});
