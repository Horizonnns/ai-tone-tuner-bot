import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";
import { userLang, i18n } from "../locales";
import crypto from "crypto";
import axios from "axios";
import express from "express";
import { recordError } from "../services/metricsService";

export const yookassaWebhookRouter = express.Router();

/**
 * Проверка подписи YooKassa (ECDSA SHA-256)
 */
async function verifySignature(rawBody: string, signatureHeader?: string) {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(" ");
  if (parts.length !== 4) return false;

  const [version, keyId, algo, signatureBase64] = parts;
  if (version !== "v1") return false;

  const { data: publicKeys } = await axios.get(
    "https://yookassa.ru/signature/public-keys"
  );

  const keyData = publicKeys.find((k) => k.id === keyId);
  if (!keyData) return false;

  const verify = crypto.createVerify("SHA256");
  verify.update(rawBody);
  verify.end();

  return verify.verify(keyData.public_key, Buffer.from(signatureBase64, "base64"));
}

yookassaWebhookRouter.post("/", async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const signatureHeader = req.headers["signature"] as string;
    log(`❌ signatureHeader: ${signatureHeader}`);
    // log(`❌ rawBody: ${JSON.stringify(req.rawBody)}`);

    // const valid = await verifySignature(rawBody, signatureHeader);
    // if (!valid) return res.status(403).send("Forbidden");
    // log(`❌ valid: ${valid}`);

    const event = JSON.parse(rawBody);
    log(`❌ event: ${event}`);

    // if (event.event !== "payment.succeeded") {
    //   return res.status(200).send("OK");
    // }

    const payment = event.object;
    const telegramId = payment.metadata?.telegramId;
    if (!telegramId) return res.status(200).send("OK");

    // Обновляем или создаем запись платежа
    await prisma.payment.upsert({
      where: { paymentId: payment.id },
      update: { status: payment.status },
      create: {
        telegramId: String(telegramId),
        paymentId: payment.id,
        amount: Number(payment.amount.value),
        currency: payment.amount.currency,
        status: payment.status,
      },
    });

    // Активируем премиум
    await prisma.user.update({
      where: { telegramId: String(telegramId) },
      data: {
        isPremium: true,
        premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Удаляем offer-сообщения
    const offers = await prisma.offerMessage.findMany({
      where: { telegramId: String(telegramId) },
    });

    for (const offer of offers) {
      try {
        await bot.telegram.deleteMessage(String(telegramId), offer.messageId);
      } catch {}
    }

    await prisma.offerMessage.deleteMany({
      where: { telegramId: String(telegramId) },
    });

    // Отправляем подтверждение пользователю
    const lang = userLang.get(String(telegramId)) || "ru";
    const t = i18n[lang];
    await bot.telegram.sendMessage(telegramId, t.premium.success, {
      parse_mode: "Markdown",
    });

    log(`💎 Premium активирован для пользователя ${telegramId}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Ошибка обработчика webhook:", err);
    recordError().catch(() => {});
    res.status(500).send("Error");
  }
});
