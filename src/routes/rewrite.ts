import express from "express";
import { rewriteText } from "../services/openai";
import { getOrCreateUser, incrementUsage } from "../services/user";

export const router = express.Router();

router.post("/rewrite", async (req, res) => {
  try {
    const { text, tone, telegramId } = req.body;
    if (!text || !tone || !telegramId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await getOrCreateUser(telegramId);
    const allowed = await incrementUsage(telegramId);
    if (!allowed) {
      return res.status(403).json({ message: "Достигнут лимит 5 текстов" });
    }

    const rewritten = await rewriteText(text, tone);
    const updatedUser = await getOrCreateUser(telegramId);

    res.json({ result: rewritten, usageCount: updatedUser.usageCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
