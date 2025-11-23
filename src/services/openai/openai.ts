import { log } from "../../utils/logger";
import { openaiClient } from "./openaiClient";
import { buildRewriteMessages } from "../prompt";

export async function rewriteText(text: string, tone: string) {
  const messages = buildRewriteMessages(text, tone);
  const payload = { model: "gpt-4o-mini", messages } as const;

  log(`OpenAI request: ${JSON.stringify(payload)}`);

  const res = await openaiClient.chat.completions.create(payload);
  const usage = (res as any).usage || {};

  log(
    `OpenAI response: choices=${res.choices?.length || 0}, tokens={ prompt:${
      usage.prompt_tokens || 0
    }, completion:${usage.completion_tokens || 0}, total:${usage.total_tokens || 0} }`
  );

  return res.choices[0].message?.content?.trim() || "";
}
