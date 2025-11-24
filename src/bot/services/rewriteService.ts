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
import dotenv from "dotenv";
dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL;

export async function handleRewriteRequest(
  ctx: any,
  originalText: string,
  tone: string,
  userId: number,
  toneDisplayName: string
) {
  const thinkingMsg = await ctx.reply("✨");

  try {
    const response = await withRetry(
      () =>
        axios.post(
          `${BACKEND_URL}/api/rewrite`,
          {
            text: originalText,
            tone,
            telegramId: String(userId),
          },
          {
            timeout: DEFAULT_TIMEOUT,
          }
        ),
      {
        onRetry: (attempt, error) => {
          logError(
            `Axios request failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}): ${error.message}. Retrying...`
          );
        },
      }
    );

    const { result, remaining, initialLimit, isPremium } = response.data;

    if (isLimitError(response)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    const totalLimit = initialLimit ?? 5;
    const used = remaining !== "∞" ? totalLimit - remaining : 0;

    const lang = userLang.get(String(userId)) || "ru";
    const t = i18n[lang];

    const attemptsInfo =
      !isPremium && remaining !== "∞" ? t.result.attempts(used, totalLimit) : "";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `${t.result.prefix(toneDisplayName)}\n\n${result}${attemptsInfo}`,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in tone "${tone}" (${used}/${totalLimit})`);
    deleteUserMessage(userId);
  } catch (err: any) {
    const errorCode = err.code || err.response?.status;
    const errorMessage = err.message || "Unknown error";
    const isNetworkError = isRetryableError(err);

    logError(
      `Ошибка при переписывании: ${errorMessage} (code: ${errorCode}, network: ${isNetworkError})`
    );

    if (isLimitError(undefined, err)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    const lang = userLang.get(String(userId)) || "ru";
    const t = i18n[lang];
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      t.errors.somethingWentWrong
    );
  }
}
