import { prisma } from "../db/client";
import { bot } from "../bot/instance";
import { log } from "../utils/logger";
import crypto from "crypto";

class YooKassaWebhooks {
  constructor(private secret: string) {}

  async verify(body: string | Buffer, signatureHeader: string): Promise<boolean> {
    if (!signatureHeader) return false;

    const parts = signatureHeader.split(" ");
    if (parts.length !== 4) return false;

    const [version, timestamp, algo, theirHmac] = parts;

    // Формируем строку строго по документации
    const signedString = `${version} ${timestamp} ${body}`;
    console.log("❌ signedString: ", signedString);

    const myHmac = crypto
      .createHmac("sha256", this.secret)
      .update(signedString)
      .digest("base64");

    log(`📬 myHmac: ${myHmac}`);
    log(`📬 theirHmac: ${theirHmac}`);

    return myHmac === theirHmac;
  }
}

const webhooks = new YooKassaWebhooks(process.env.YOOKASSA_SECRET!);

export default async function yookassaWebhookHandler(req, res) {
  try {
    if (!(req.body instanceof Buffer)) {
      console.error("❌ raw body is not Buffer");
      return res.status(400).send("Invalid body");
    }

    const bodyString = req.body.toString("utf8");
    const signatureHeader = req.headers["signature"];

    // 💥 Проверка как в Octokit: verify(body, signature)
    // if (!(await webhooks.verify(bodyString, signatureHeader))) {
    //   console.error("❌ Подпись неверна!");
    //   return res.status(403).send("Forbidden");
    // }
    // console.log("✅ Подпись верна!");

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
            premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        try {
          const offers = await (prisma as any).offerMessage.findMany({
            where: { telegramId: String(telegramId) },
          });

          for (const offer of offers) {
            try {
              await bot.telegram.deleteMessage(String(telegramId), offer.messageId);
            } catch {}
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
