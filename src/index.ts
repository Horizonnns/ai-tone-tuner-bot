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
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Запуск бота
bot.launch();
log("🤖 Telegram бот запущен!");
