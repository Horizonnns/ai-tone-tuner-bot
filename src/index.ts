import "./bot/index"; // <- важно, чтобы бот подключился
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import paymentsRouter from "./routes/payments";

import { bot } from "./bot/instance";
import { log } from "./utils/logger";
import { router as rewriteRouter } from "./routes/rewrite";
import { initScheduler } from "./scheduler/resetDailyLimit";

dotenv.config();
const app = express();
// app.use("/api/payments/webhook", bodyParser.raw({ type: "*/*" }));
app.use("/api/payments", paymentsRouter, bodyParser.raw({ type: "application/json" }));
app.use(express.json());

// Telegram webhook endpoint
app.post("/api/webhook", async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка при обработке webhook:", err);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Server is alive!");
});

// Подключаем маршруты
app.use("/api", rewriteRouter);

// Запускаем планировщик
initScheduler();
const PORT = process.env.PORT || 4000;
const BACKEND_URL = process.env.BACKEND_URL;

// Запуск сервера и бота через webhook
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Устанавливаем webhook для Telegram через Express роут
  const webhookUrl = `${BACKEND_URL}/api/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  log(`🤖 Telegram бот webhook установлен: ${webhookUrl}`);
});
