import "./bot/index";
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

// Endpoint для Telegram webhook
app.post("/api/webhook", async (req, res) => {
  try {
    await bot.handleUpdate(req.body); // Telegraf обработает обновление
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Запускаем планировщик
initScheduler();

const PORT = Number(process.env.PORT || 4000);
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL;

// Запуск сервера и бота через webhookf
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Устанавливаем webhook для Telegram
  await bot.launch({
    webhook: { domain: RAILWAY_URL, port: PORT, hookPath: "/api/webhook" },
  });

  log("🤖 Telegram бот запущен через webhook!");
});
