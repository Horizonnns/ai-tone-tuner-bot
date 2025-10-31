import express from "express";
import { rewriteText } from "../services/openai";
import { prisma } from "../db/client";
import { getOrCreateUser } from "../services/user";

export const router = express.Router();

router.post("/rewrite", async (req, res) => {
  try {
    const { text, tone, telegramId } = req.body;

    if (!text || !tone || !telegramId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Получаем или создаём пользователя
    const user = await getOrCreateUser(telegramId);

    // 💎 Premium — безлимит
    if (user.isPremium) {
      const rewritten = await rewriteText(text, tone);
      return res.json({
        result: rewritten,
        remaining: "∞",
        isPremium: true,
        message: "Premium user — no limits",
      });
    }

    // 🧮 Проверяем, есть ли попытки
    if (user.dailyLimit <= 0) {
      return res.status(403).json({
        message: "Достигнут лимит попыток на сегодня",
      });
    }

    // ✍️ Переписываем текст
    const rewritten = await rewriteText(text, tone);

    // Вычисляем начальный общий лимит: базовый (5) + реферальные попытки за сегодня
    // Это нужно для корректного отображения прогресса (1/5, 2/5, 3/5...) с постоянным знаменателем
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const referralsCount = await prisma.referral.count({
      where: { inviterId: telegramId, createdAt: { gte: todayStart } },
    });
    const totalLimit = 5 + referralsCount * 2;

    // 🔻 Уменьшаем лимит на 1
    const updatedUser = await prisma.user.update({
      where: { telegramId },
      data: { dailyLimit: { decrement: 1 }, lastUsedAt: new Date() },
    });

    return res.json({
      result: rewritten,
      remaining: updatedUser.dailyLimit,
      initialLimit: totalLimit,
      isPremium: false,
      message: `Осталось ${updatedUser.dailyLimit} попыток`,
    });
  } catch (err) {
    console.error("❌ Ошибка в /rewrite:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
