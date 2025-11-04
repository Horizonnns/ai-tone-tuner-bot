import OpenAI from "openai";
import dotenv from "dotenv";
import { log } from "../utils/logger";
import { toneLabel } from "../bot/tones";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

export async function rewriteText(text: string, tone: string) {
  const normalizedTone = toneLabel(tone);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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
      content: `Текст для переписывания: ${text}. Ответь только готовым текстом, без пояснений`,
    },
  ];

  const payload = { model: "gpt-4o-mini", messages } as const;
  log(`OpenAI request: ${JSON.stringify(payload)}`);

  const res = await openai.chat.completions.create(payload);

  const usage = (res as any).usage || {};
  log(
    `OpenAI response: choices=${res.choices?.length || 0}, tokens={ prompt:${
      usage.prompt_tokens || 0
    }, completion:${usage.completion_tokens || 0}, total:${usage.total_tokens || 0} }`
  );

  return res.choices[0].message?.content?.trim() || "";
}
