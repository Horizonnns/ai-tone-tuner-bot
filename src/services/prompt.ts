import OpenAI from "openai";
import { toneLabel } from "../bot/tones";
import { userLang, i18n } from "../locales";

export function buildRewriteMessages(
  text: string,
  toneKeyOrLabel: string,
  userId?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  // Определяем язык пользователя
  const lang = userId && userId !== "default" ? userLang.get(userId) || "ru" : "ru";
  const t = i18n[lang];

  // Используем userId если передан, иначе используем дефолтный "ru"
  const normalizedTone = toneLabel(toneKeyOrLabel, userId || "default");

  return [
    { role: "system", content: t.prompt.system(normalizedTone) },
    { role: "user", content: `${t.prompt.user} ${text}` },
  ];
}
