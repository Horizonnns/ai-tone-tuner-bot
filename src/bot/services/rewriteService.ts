import axios from "axios";
import { log, logError } from "../../utils/logger";
import { deleteUserMessage } from "../../services/messageCache";
import { handleLimitReached, isLimitError } from "../helpers";
import { userLang, i18n } from "../../locales";
import {
  withRetry,
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  isRetryableError,
} from "../../utils/retryTimeout";
import { recordError } from "../../services/metricsService";
import dotenv from "dotenv";
dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL;
const LONG_WAIT_THRESHOLD_MS = 8000;

export async function handleRewriteRequest(
  ctx: any,
  originalText: string,
  tone: string,
  userId: number,
  toneDisplayName: string
) {
  const thinkingMsg = await ctx.reply("✨");
  const userIdStr = String(userId);
  const lang = userLang.get(userIdStr) || "ru";
  const t = i18n[lang];

  let waitTimeout: NodeJS.Timeout | null = null;
  let waitMessageShown = false;

  try {
    waitTimeout = setTimeout(() => {
      waitMessageShown = true;
      const waitText =
        t.status?.longWait || "⏳ AI думает чуть дольше обычного... спасибо за терпение!";
      ctx.telegram
        .editMessageText(ctx.chat.id, thinkingMsg.message_id, undefined, waitText)
        .catch((err: any) =>
          logError(`Не удалось показать сообщение ожидания: ${err?.message || err}`)
        );
    }, LONG_WAIT_THRESHOLD_MS);

    let attemptCount = 1;
    const requestStartedAt = Date.now();

    const response = await withRetry(
      () =>
        axios.post(
          `${BACKEND_URL}/api/rewrite`,
          { text: originalText, tone, telegramId: String(userId) },
          {
            timeout: DEFAULT_TIMEOUT,
          }
        ),
      {
        onRetry: (attempt, error) => {
          attemptCount = attempt + 1;
          logError(
            `Axios request failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}): ${error.message}`
          );
        },
      }
    );

    const latency = Date.now() - requestStartedAt;

    log(
      `Rewrite latency: user=${userId}, tone=${tone}, duration=${latency}ms, attempts=${attemptCount}, waitMessageShown=${waitMessageShown}`
    );

    const data = response.data;
    const totalLimit = data.initialLimit ?? 5;
    const remaining = data.remaining ?? 0;
    const usedAttempts = remaining !== "∞" ? totalLimit - Number(remaining ?? 0) : 0;

    const attemptsInfo =
      !data.isPremium && remaining !== "∞"
        ? t.result.attempts(usedAttempts, totalLimit)
        : "";

    const finalText = `${t.result.prefix(toneDisplayName)}\n\n${
      data.result
    }${attemptsInfo}`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      finalText,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in tone "${tone}" (${usedAttempts}/${totalLimit})`);
    deleteUserMessage(userId);
  } catch (err: any) {
    const errorCode = err.code || err.response?.status;
    const errorMessage = err.message || "Unknown error";
    const isNetworkError = isRetryableError(err);

    logError(
      `Ошибка при переписывании: ${errorMessage} (code: ${errorCode}, network: ${isNetworkError})`
    );

    // Записываем метрику ошибки (кроме ошибок лимита, так как это не системная ошибка)
    if (!isLimitError(undefined, err)) {
      recordError().catch(() => {});
    }

    if (isLimitError(undefined, err)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      t.errors.somethingWentWrong
    );
  } finally {
    if (waitTimeout) clearTimeout(waitTimeout);
  }
}
