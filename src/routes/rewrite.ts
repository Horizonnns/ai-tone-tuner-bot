import express from "express";
import { getOrCreateUser } from "../services/user";
import { recordLatencySample } from "../utils/metrics";
import { RewriteJobOptions, rewriteQueue } from "../services/rewrite/rewriteQueue";
import { getUserLimits, decrementUserLimit } from "../services/rewrite/rewriteLimiter";
import { recordError } from "../services/metricsService";

export const router = express.Router();

router.post("/rewrite", async (req, res) => {
  const { text, tone, telegramId } = req.body || {};

  if (!text || !tone || !telegramId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await getOrCreateUser(telegramId);
    const limits = await getUserLimits(telegramId);

    if (
      !limits.isPremium &&
      typeof limits.dailyLimit === "number" &&
      limits.dailyLimit <= 0
    ) {
      return res.status(403).json({ message: "Достигнут лимит на сегодня" });
    }

    const initialLimitValue = Number.isFinite(limits.limit) ? limits.limit : undefined;

    const rewriteResult = await rewriteQueue.enqueue(<RewriteJobOptions>{
      text,
      tone,
      telegramId,
    });

    recordLatencySample(rewriteResult.latency);

    if (!limits.isPremium) {
      const updated = await decrementUserLimit(telegramId);
      return res.json({
        result: rewriteResult.result,
        remaining: updated.dailyLimit,
        initialLimit: initialLimitValue,
        isPremium: false,
        latency: rewriteResult.latency,
        attempts: rewriteResult.attempts,
      });
    }

    return res.json({
      result: rewriteResult.result,
      remaining: "∞",
      isPremium: true,
      initialLimit: initialLimitValue,
      latency: rewriteResult.latency,
      attempts: rewriteResult.attempts,
    });
  } catch (err) {
    console.error("❌ Ошибка в /rewrite:", err);
    recordError().catch(() => {});
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
