import { isIPv4 } from "net";
import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";
import express, { Request, Response } from "express";

import axios from "axios";
import bodyParser from "body-parser";

const router = express.Router();

// Разрешённые диапазоны IP YooKassa (из документации)
const allowedIpRanges = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

// Функция, проверяющая, лежит ли IP в диапазонах (можно использовать библиотеку, например `ip-cidr`)
function ipAllowed(remoteAddress: string): boolean {
  // Простейшая проверка — можно заменить на более точную
  // Здесь для примера — проверка на префикс (достаточно грубая)
  for (const range of allowedIpRanges) {
    const [base, prefix] = range.split("/");
    if (!prefix) continue;
    const prefixNum = Number(prefix);
    // Только очень простая проверка для IPv4
    if (isIPv4(remoteAddress) && isIPv4(base)) {
      const remoteParts = remoteAddress.split(".").map(Number);
      const baseParts = base.split(".").map(Number);
      const mask = prefixNum === 0 ? 0 : (~0 << (32 - prefixNum)) >>> 0;
      const remoteInt = remoteParts.reduce((acc, p) => (acc << 8) + p, 0);
      const baseInt = baseParts.reduce((acc, p) => (acc << 8) + p, 0);
      if ((remoteInt & mask) === (baseInt & mask)) {
        return true;
      }
    }
    // Для IPv6: можно добавить отдельную логику с библиотекой `ip-address` или `ip-cidr`
  }
  return false;
}

router.get("/create", async (req: Request, res: Response) => {
  const telegramId = String(req.query.telegramId || "");
  if (!telegramId) {
    return res.status(400).json({ error: "telegramId required" });
  }

  try {
    const yookassaRes = await axios.post(
      "https://api.yookassa.ru/v3/payments",
      {
        amount: { value: "199.00", currency: "RUB" },
        confirmation: {
          type: "redirect",
          return_url: `${process.env.BACKEND_URL}/api/payments/success?telegramId=${telegramId}`,
        },
        capture: true,
        description: `AI Tone Tuner Premium для пользователя ${telegramId}`,
        metadata: { telegramId },
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID!,
          password: process.env.YOOKASSA_SECRET!,
        },
        headers: {
          "Idempotence-Key": `${telegramId}-${Date.now()}`,
          "Content-Type": "application/json",
        },
      }
    );

    const confirmation = yookassaRes.data.confirmation?.confirmation_url;
    log(`💰 Создан платёж. Redirect → ${confirmation}`);
    return res.redirect(confirmation);
  } catch (error: any) {
    log(
      `❌ Ошибка create payment: ${JSON.stringify(error.response?.data || error.message)}`
    );
    return res.status(500).json({ error: error.response?.data || error.message });
  }
});

router.get("/success", async (_req: Request, res: Response) => {
  return res.send(
    "✅ Оплата прошла успешно! Premium активируется в течение минуты — вернись в Telegram."
  );
});

router.post(
  "/webhook",
  bodyParser.json(), // теперь просто JSON, без raw
  async (req: Request, res: Response) => {
    try {
      const remote = req.socket.remoteAddress;
      if (!remote) {
        log("❌ Не удалось определить IP отправителя webhook");
        return res.status(403).send("Forbidden");
      }

      if (!ipAllowed(remote)) {
        log(`🔒 Webhook пришёл с недопустимого IP: ${remote}`);
        return res.status(403).send("Forbidden");
      }

      const event = req.body;
      log(`📬 Пришёл webhook: ${JSON.stringify(event, null, 2)}`);

      if (event.type !== "notification") {
        log("⚠️ Неизвестный тип webhook:", event.type);
        return res.status(200).send("Ignored");
      }

      if (!event.object || !event.object.id) {
        log("❌ В webhook нет объекта или id");
        return res.status(400).send("Bad request");
      }

      const paymentId = event.object.id;
      const telegramId = event.object.metadata?.telegramId;

      // Проверяем статус через API YooKassa
      const apiRes = await axios.get(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID!,
          password: process.env.YOOKASSA_SECRET!,
        },
      });
      log(`apiRes → ${apiRes}`);

      const realStatus = apiRes.data.status;
      const webhookStatus = event.object.status;

      log(`🔍 Статус через API: ${realStatus}, в webhook: ${webhookStatus}`);

      if (realStatus !== webhookStatus) {
        log("⚠️ Статусы не совпадают, возможно поддельный webhook или гонка статусов");
        return res.status(400).send("Status mismatch");
      }

      if (event.event !== "payment.succeeded" || realStatus !== "succeeded") {
        // не тот статус, который тебе нужен — просто игнорируем
        return res.status(200).send("Ignored");
      }

      if (!telegramId) {
        log("⚠️ В metadata платежа нет telegramId");
        return res.status(200).send("No telegramId");
      }

      // Сохраняем платёж
      await prisma.payment.upsert({
        where: { paymentId },
        update: { status: realStatus },
        create: {
          telegramId,
          paymentId,
          amount: Number(event.object.amount.value),
          currency: event.object.amount.currency,
          status: realStatus,
        },
      });

      log(`💾 Платёж сохранён: ${paymentId}`);

      // Активация премиума
      await prisma.user.update({
        where: { telegramId },
        data: {
          isPremium: true,
          premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      log(`💎 Premium активирован для пользователя ${telegramId}`);

      await bot.telegram.sendMessage(
        telegramId,
        "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
        { parse_mode: "Markdown" }
      );

      return res.status(200).send("OK");
    } catch (err: any) {
      log(`❌ Ошибка webhook-обработчика: ${err.stack || err.message}`);
      return res.status(500).send("Error");
    }
  }
);

export default router;
