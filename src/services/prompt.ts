import OpenAI from "openai";
import { toneLabel } from "../bot/tones";

export function buildRewriteMessages(
  text: string,
  toneKeyOrLabel: string,
  userId?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  // Используем userId если передан, иначе используем дефолтный "ru"
  const normalizedTone = toneLabel(toneKeyOrLabel, userId || "default");
  return [
    {
      role: "system",
      content: `Ты профессиональный редактор и копирайтер. Перепиши данный текст в ${normalizedTone}.
      Обязательно:
      - Сделай текст естественным и легко читаемым.
      - Добавь лёгкие штрихи эмоций и выразительности, соответствующие стилю.
      - Если текст короткий (1–2 фразы), сделай его немного живее, но не чрезмерно украшай.`,
    },
    {
      role: "user",
      content: `Текст для переписывания: ${text}`,
    },
  ];
}
