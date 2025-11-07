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

const PORT = Number(process.env.PORT) || 4000;
const WEBHOOK_DOMAIN =
  process.env.RAILWAY_STATIC_URL || "ai-tone-tuner-bot-production.up.railway.app";
const WEBHOOK_PATH = "/api/webhook";

// Инициализация и запуск сервера
(async () => {
  // Настройка webhook или polling
  const useWebhook = !!WEBHOOK_DOMAIN;

  if (useWebhook) {
    // Подключаем webhook middleware для Express
    app.use(WEBHOOK_PATH, await bot.createWebhook({ domain: WEBHOOK_DOMAIN }));
  }

  // Запуск сервера и бота
  app.listen(PORT, async () => {
    log(`🚀 Server running on port ${PORT}`);

    if (useWebhook) {
      // Устанавливаем webhook для Telegram
      const webhookUrl = `https://${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`;
      await bot.telegram.setWebhook(webhookUrl);
      log(`🤖 Telegram бот запущен через webhook: ${webhookUrl}`);
    } else {
      // Используем polling для разработки
      bot.launch();
      log("🤖 Telegram бот запущен в polling режиме!");
    }
  });
})();
