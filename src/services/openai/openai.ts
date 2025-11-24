import { log, logError } from "../../utils/logger";
import { openaiClient } from "./openaiClient";
import { buildRewriteMessages } from "../prompt";
import { withRetry, DEFAULT_MAX_RETRIES } from "../../utils/retryTimeout";

export async function rewriteWithOpenAI(text: string, tone: string, telegramId?: string) {
  const messages = buildRewriteMessages(text, tone, telegramId);
  const payload = { model: "gpt-4o-mini", messages } as const;

  log(`OpenAI request: ${JSON.stringify(payload)}`);

  try {
    const res = await withRetry(() => openaiClient.chat.completions.create(payload), {
      onRetry: (attempt, error) => {
        logError(
          `OpenAI request failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}): ${
            error.message || error.type || "Unknown error"
          }. Retrying...`
        );
      },
    });
    const usage = (res as any).usage || {};

    log(
      `OpenAI response: choices=${res.choices?.length || 0}, tokens={ prompt:${
        usage.prompt_tokens || 0
      }, completion:${usage.completion_tokens || 0}, total:${usage.total_tokens || 0} }`
    );

    return res.choices[0].message?.content?.trim() || "";
  } catch (error: any) {
    const errorCode = error.code || error.status || error.type;
    const errorMessage = error.message || "Unknown error";
    logError(`OpenAI API error: ${errorMessage} (code: ${errorCode})`);
    throw error;
  }
}
