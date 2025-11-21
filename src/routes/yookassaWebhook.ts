import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";
import crypto from "crypto";
import axios from "axios";
import express from "express";

export const yookassaWebhookRouter = express.Router();

/**
 * Проверка подписи YooKassa (ECDSA SHA-256)
 */
async function verifyYooKassaSignature(
  rawBody: string,
  signatureHeader?: string
): Promise<boolean> {
  try {
    if (!signatureHeader) return false;

    const parts = signatureHeader.split(" ");
    if (parts.length !== 4) return false;

    const [version, keyId, algo, signatureBase64] = parts;

    if (version !== "v1") return false;

    // Получаем публичный ключ по keyId
    const { data: publicKeys } = await axios.get(
      "https://yookassa.ru/signature/public-keys"
    );
    const keyData = publicKeys.find((k) => k.id === keyId);

    if (!keyData) {
      log(`❌ Публичный ключ с id ${keyId} не найден`);
      return false;
    }

    const publicKeyPem = keyData.public_key;
    const signature = Buffer.from(signatureBase64, "base64");

    // Проверка подписи
    const verify = crypto.createVerify("SHA256");
    verify.update(rawBody);
    verify.end();

    const valid = verify.verify(publicKeyPem, signature);

    if (!valid) log("❌ Подпись неверна");
    else log("✅ Подпись валидна");

    return valid;
  } catch (err) {
    console.error("Ошибка при проверке подписи:", err);
    return false;
  }
}

/**
 * Webhook handler
 */
yookassaWebhookRouter.post("/", async (req, res) => {
  try {
    const rawBody: string = req.rawBody; // ← сырой JSON, сохранённый в express.json verify
    const signatureHeader = req.headers["y-signature"] as string;
    log(`❌signatureHeader: ${signatureHeader}`);

    // Проверка подписи YooKassa
    const isValid = await verifyYooKassaSignature(rawBody, signatureHeader);

    if (!isValid) {
      return res.status(403).send("Forbidden");
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.succeeded") {
      const payment = event.object;

      const telegramId = payment.metadata?.telegramId;
      if (!telegramId) {
        log("⚠ Оплата без telegramId — пропуск");
        return res.status(200).send("OK");
      }

      // Сохраняем или обновляем оплату
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

      // Обновляем премиум
      await prisma.user.update({
        where: { telegramId: String(telegramId) },
        data: {
          isPremium: true,
          premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Удаляем старые offer-сообщения
      try {
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
      } catch {}

      // Отправляем сообщение пользователю
      await bot.telegram.sendMessage(
        telegramId,
        "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
        { parse_mode: "Markdown" }
      );

      log(`💎 Premium активирован для пользователя ${telegramId}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Ошибка обработчика webhook:", err);
    res.status(500).send("Error");
  }
});
