import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";
import crypto from "crypto";

export default async function yookassaWebhookHandler(req, res) {
  try {
    // !ВРЕМЕННО ЗАКОМЕНТИРОВАЛ!
    if (!(req.body instanceof Buffer)) {
      console.error("❌ raw body is not Buffer");
      return res.status(400).send("Invalid body");
    }

    const bodyString = req.body.toString("utf8");
    const signature = req.headers["signature"].split(" ");

    log(`📬 signature: ${signature}`);
    log(`📬 req.body instanceof Buffer: ${req.body instanceof Buffer}`);

    const secret = process.env.YOOKASSA_SECRET!;
    const myHmac = crypto.createHmac("sha256", secret).update(req.body).digest("base64");
    log(`📬 myHmac: ${myHmac}`);

    // if (myHmac !== signature[3]) {
    //   console.error("❌ Подпись неверна!");
    //   return res.status(400).send("Invalid signature");
    // }

    // console.log("✅ Подпись верна!");
    // !ВРЕМЕННО ЗАКОМЕНТИРОВАЛ!

    const event = JSON.parse(bodyString);

    if (event.event === "payment.succeeded") {
      const payment = event.object;
      const telegramId = payment.metadata?.telegramId;

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

      if (telegramId) {
        await prisma.user.update({
          where: { telegramId: String(telegramId) },
          data: {
            isPremium: true,
            premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
          },
        });

        // Удаляем все ранее отправленные оффер-сообщения
        try {
          const offers = await (prisma as any).offerMessage.findMany({
            where: { telegramId: String(telegramId) },
          });
          for (const offer of offers) {
            try {
              await bot.telegram.deleteMessage(String(telegramId), offer.messageId);
            } catch {
              // пропускаем ошибки удаления (могло быть удалено вручную/истекло)
            }
          }
          await (prisma as any).offerMessage.deleteMany({
            where: { telegramId: String(telegramId) },
          });
        } catch {}

        await bot.telegram.sendMessage(
          telegramId,
          "🎉 Оплата прошла успешно!\n💎 *AI Tone Tuner Premium* активирован на 30 дней",
          { parse_mode: "Markdown" }
        );

        log(`✅ Premium активирован для пользователя ${telegramId}`);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Ошибка при обработке webhook:", err);
    res.status(500).send("Error");
  }
}
