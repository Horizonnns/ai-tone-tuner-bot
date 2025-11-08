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
app.use("/api/payments", paymentsRouter);

// Запускаем планировщик
initScheduler();
const PORT = process.env.PORT || 4000;

// Запуск сервера и бота через webhook
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  await bot.launch({});
  log("🤖 Telegram бот запущен через webhook!");
});
