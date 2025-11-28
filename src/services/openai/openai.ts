import { log, logError } from "../../utils/logger";
import { openaiClient } from "./openaiClient";
import { buildRewriteMessages } from "../prompt";
import { withRetry, DEFAULT_MAX_RETRIES } from "../../utils/retryTimeout";

export interface RewriteCallOptions {
  stream?: boolean;
}

export interface RewriteResult {
  result: string;
  latency: number;
  attempts: number;
  usage: { prompt: number; completion: number; total: number };
}

export async function rewriteWithOpenAI(
  text: string,
  tone: string,
  telegramId?: string
): Promise<RewriteResult> {
  const messages = buildRewriteMessages(text, tone, telegramId);
  const payload = { model: "gpt-4o-mini", messages };

  const startedAt = Date.now();

  log(`OpenAI request: ${JSON.stringify(payload)}`);

  try {
    let attemptCount = 1;

    const res = await withRetry(
      () => openaiClient.chat.completions.create(payload as any),
      {
        onRetry: (attempt, error) => {
          attemptCount = attempt + 1;
          logError(
            `OpenAI request failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}): ${
              error.message || error.type || "Unknown error"
            }`
          );
        },
      }
    );

    const latency = Date.now() - startedAt;

    const usage = (res as any).usage || {};
    const usagePayload = {
      prompt: usage.prompt_tokens || 0,
      completion: usage.completion_tokens || 0,
      total: usage.total_tokens || 0,
    };

    log(
      `OpenAI response: latency=${latency}ms tokens={ prompt:${usagePayload.prompt}, completion:${usagePayload.completion}, total:${usagePayload.total} }`
    );

    return {
      result: res.choices[0]?.message?.content?.trim() || "",
      attempts: attemptCount,
      latency,
      usage: usagePayload,
    };
  } catch (error: any) {
    const errorCode = error.code || error.status || error.type;
    logError(`OpenAI API error: ${error.message} (code: ${errorCode})`);
    throw error;
  }
}
