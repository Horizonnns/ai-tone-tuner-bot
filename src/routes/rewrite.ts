import express from "express";
import { rewriteWithOpenAI } from "../services/openai/openai";
import { getOrCreateUser } from "../services/user";
import { getUserLimits, decrementUserLimit } from "../services/rewrite/rewriteLimiter";

export const router = express.Router();

router.post("/rewrite", async (req, res) => {
  try {
    const { text, tone, telegramId } = req.body;
    if (!text || !tone || !telegramId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await getOrCreateUser(telegramId);
    const limits = await getUserLimits(telegramId);

    if (!limits.isPremium && limits.dailyLimit <= 0) {
      return res.status(403).json({ message: "Достигнут лимит на сегодня" });
    }

    const rewritten = await rewriteWithOpenAI(text, tone);

    if (!limits.isPremium) {
      const updated = await decrementUserLimit(telegramId);
      return res.json({
        result: rewritten,
        remaining: updated.dailyLimit,
        initialLimit: limits.limit,
        isPremium: false,
      });
    }

    return res.json({ result: rewritten, remaining: "∞", isPremium: true });
  } catch (err) {
    console.error("❌ Ошибка в /rewrite:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
