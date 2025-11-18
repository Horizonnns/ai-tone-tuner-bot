import express, { Request, Response } from "express";
import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";

import axios from "axios";
import crypto from "crypto";
import bodyParser from "body-parser";
const router = express.Router();

// ---------------------
// TYPES
// ---------------------
interface IYooMoneyAmount {
  value: string;
  currency: string;
}

interface IYooMoneyPaymentObject {
  id: string;
  status: string;
  amount: IYooMoneyAmount;
  metadata?: { telegramId?: string };
}

interface IYooMoneyWebhookEvent {
  type: string;
  event: string;
  object: IYooMoneyPaymentObject;
}

// ---------------------
// HELPERS
// ---------------------

/**
 * Проверка подписи webhook от YooKassa.
 */
function verifySignature(
  body: any,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  if (!secret) return false;

  // Формат: "sha256=HEXSTRING"
  const signature = signatureHeader.replace("sha256=", "").trim();

  const computed = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
}

// ---------------------
// ROUTE: CREATE PAYMENT
// ---------------------
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

// ---------------------
// ROUTE: SUCCESS REDIRECT
// ---------------------
router.get("/success", async (_req: Request, res: Response) => {
  return res.send(
    "✅ Оплата прошла успешно! Premium активируется в течение минуты — вернись в Telegram."
  );
});

// ---------------------
// ROUTE: WEBHOOK
// ---------------------

router.post(
  "/webhook",
  bodyParser.raw({ type: "*/*" }), // получить raw body
  async (req: Request, res: Response) => {
    try {
      const signatureHeader = req.header("signature");
      log(`🚀 signatureHeader: ${signatureHeader}`);
      // log(`🚀 headers: ${JSON.stringify(req.headers, null, 2)}`);

      if (!signatureHeader) {
        log("❌ Нет подписи в заголовках");
        return res.status(401).send("Missing signature");
      }

      const parts = signatureHeader.split(" ");
      const base64Signature = parts[3]; // сама подпись (base64)
      log(`🚀 base64Signature: ${base64Signature}`);

      const rawBody = req.body; // buffer
      // log(`🚀 rawBody: ${rawBody}`);
      log(`🚀 rawBody: ${JSON.stringify(rawBody, null, 2)}`);

      const secret = process.env.YOOKASSA_SECRET!;

      // createHmac("sha256", test_wKfO1D1u9AgfOJkmhlwmGTEtJW2is4BIYzauXSFpkB0)
      // .update(rawBody)
      // .digest("base64");

      // compute HMAC
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("base64");
      log(`🚀 expectedSignature: ${expectedSignature}`);

      if (expectedSignature !== base64Signature) {
        log("❌ Неверная подпись webhook — отклонено");
        return res.status(401).send("Invalid signature");
      }

      log("✅ Подпись корректна");

      // Теперь можно распарсить JSON
      const event = JSON.parse(rawBody.toString());
      log(`📬 Webhook OK: ${JSON.stringify(event, null, 2)}`);

      // --- Дальнейшая логика ---
      if (event.event !== "payment.succeeded") {
        return res.status(200).send("Ignored");
      }

      const payment = event.object;
      const telegramId = payment.metadata?.telegramId;

      if (!telegramId) {
        log("⚠️ В webhook нет telegramId");
        return res.status(200).send("No telegramId");
      }

      // Сохранение платежа
      await prisma.payment.upsert({
        where: { paymentId: payment.id },
        update: { status: payment.status },
        create: {
          telegramId,
          paymentId: payment.id,
          amount: Number(payment.amount.value),
          currency: payment.amount.currency,
          status: payment.status,
        },
      });

      log(`💾 Платёж сохранён: ${payment.id}`);

      // Активация премиума
      await prisma.user.update({
        where: { telegramId },
        data: {
          isPremium: true,
          premiumUntil: new Date(Date.now() + 30 * 86400000),
        },
      });

      log(`💎 Premium активирован: ${telegramId}`);

      await bot.telegram.sendMessage(
        telegramId,
        "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
        { parse_mode: "Markdown" }
      );

      res.status(200).send("OK");
    } catch (err: any) {
      log(`❌ Ошибка webhook: ${err.message}`);
      return res.status(500).send("Error");
    }
  }
);

export default router;
