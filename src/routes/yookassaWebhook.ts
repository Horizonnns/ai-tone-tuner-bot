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
    log(`📬 Webhook raw body: ${bodyString}`);

    const sigHeader = req.headers["signature"];
    log(`📬 sigHeader: ${sigHeader}`);

    // const secret = process.env.YOOKASSA_SECRET!;
    // const signature = Array.isArray(sigHeader) ? sigHeader.join(" ") : sigHeader;

    // const [v, ts, r, theirHmac] = signature.split(" ");
    // log(`📬 signature: ${signature}`);

    // const myHmac = crypto.createHmac("sha256", secret).update(req.body).digest("base64");

    // if (myHmac !== theirHmac) {
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
            premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

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
