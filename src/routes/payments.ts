import express, { Request, Response } from "express";
import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";

import axios from "axios";
import crypto from "crypto";
import bodyParser from "body-parser";
const router = express.Router();

// ---------------------
// HELPERS
// ---------------------
type TSignatureAlgo = "RSA-SHA256";

const signatureAlgoMap: Record<string, TSignatureAlgo> = {
  "1": "RSA-SHA256",
};

function parseSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.trim().split(/\s+/);

  if (parts.length < 4 || parts[0] !== "v1") {
    throw new Error("Unsupported signature header format");
  }

  const [, keyId, algoId, signatureBase64] = parts;
  const algorithm = signatureAlgoMap[algoId];

  if (!algorithm) {
    throw new Error(`Unsupported signature algorithm: ${algoId}`);
  }

  return { keyId, algorithm, signatureBase64 };
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

// Кеш ключей, чтобы не запрашивать их каждый раз
const webhookKeyCache = new Map<string, string>();

async function getPublicKeyByKeyId(keyId: string): Promise<string> {
  // Проверяем кеш
  if (webhookKeyCache.has(keyId)) {
    return webhookKeyCache.get(keyId)!;
  }

  // Запрашиваем у YooKassa
  const response = await axios.get(`https://api.yookassa.ru/v3/webhook_keys/${keyId}`, {
    auth: {
      username: process.env.YOOKASSA_SHOP_ID!,
      password: process.env.YOOKASSA_SECRET!,
    },
  });

  const publicKey = response.data.public_key;

  // кладём в кеш
  webhookKeyCache.set(keyId, publicKey);

  return publicKey;
}

router.post(
  "/webhook",
  bodyParser.raw({ type: "*/*" }), // важно!
  async (req: Request, res: Response) => {
    try {
      const signatureHeader = req.header("signature");
      if (!signatureHeader) {
        log("❌ Нет заголовка Signature");
        return res.status(401).send("Missing signature");
      }

      // Парсим header
      const { keyId, algorithm, signatureBase64 } = parseSignatureHeader(signatureHeader);
      log(`🔐 Webhook signature: keyId=${keyId}, algo=${algorithm}`);

      // Получаем публичный ключ Yookassa
      const publicKey = await getPublicKeyByKeyId(keyId);

      const rawBody = req.body as Buffer;

      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(rawBody);
      verifier.end();

      const isValid = verifier.verify(publicKey, signatureBase64, "base64");

      if (!isValid) {
        log("❌ Неверная подпись webhook — отклонено");
        return res.status(401).send("Invalid signature");
      }

      log("✅ Подпись валидна (webhook принят)");

      // Теперь можно парсить JSON
      const event = JSON.parse(rawBody.toString());
      log(`📬 Webhook data: ${JSON.stringify(event, null, 2)}`);

      // Игнорируем неудачные события
      if (event.event !== "payment.succeeded") {
        return res.status(200).send("Ignored");
      }

      const payment = event.object;
      const telegramId = payment.metadata?.telegramId;

      if (!telegramId) {
        log("⚠️ В metadata отсутствует telegramId");
        return res.status(200).send("No telegramId");
      }

      // Записываем платёж
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

      log(`💾 Платёж сохранен: ${payment.id}`);

      // Активируем премиум
      await prisma.user.update({
        where: { telegramId },
        data: {
          isPremium: true,
          premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      log(`💎 Premium активирован для пользователя: ${telegramId}`);

      // Отправляем сообщение в телеграм
      await bot.telegram.sendMessage(
        telegramId,
        "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
        { parse_mode: "Markdown" }
      );

      res.status(200).send("OK");
    } catch (err: any) {
      log(`❌ Ошибка обработчика webhook: ${err.message}`);
      return res.status(500).send("Error");
    }
  }
);

export default router;
