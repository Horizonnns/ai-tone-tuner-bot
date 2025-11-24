import "./bot/index"; // <- важно, чтобы бот подключился
import dotenv from "dotenv";
import express from "express";
import paymentsRouter from "./routes/payments";

import { bot } from "./bot/instance";
import { log } from "./utils/logger";
import { router as rewriteRouter } from "./routes/rewrite";
import { initScheduler } from "./scheduler/resetDailyLimit";
import { yookassaWebhookRouter } from "./routes/yookassaWebhook";

dotenv.config();
const app = express();

// 1) RAW только для ЮKassa
app.use(
  express.json({
    verify: (req, _res, buf: Buffer) => {
      // приведение типа — решает проблему TS2339
      (req as express.Request).rawBody = buf.toString("utf8");
    },
  })
);

// app.post("/api/payments/webhook", express.raw({ type: "*/*" }), yookassaWebhookHandler);
app.use("/api/yookassa/webhook", yookassaWebhookRouter);

// 2) JSON для всех остальных
app.use(express.json());

// 3) Остальные маршруты
app.use("/api/payments", paymentsRouter);
app.use("/api", rewriteRouter);

// Telegram webhook
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

// Запуск планировщика
initScheduler();

const PORT = process.env.PORT || 4000;
const BACKEND_URL = process.env.BACKEND_URL;

// Запуск сервера и бота через webhook
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  bot.launch();

  // Устанавливаем webhook для Telegram через Express роут
  const webhookUrl = `${BACKEND_URL}/api/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  log(`🤖 Telegram бот webhook установлен: ${webhookUrl}`);
});
