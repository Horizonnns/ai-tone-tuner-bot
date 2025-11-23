import axios from "axios";
import { log, logError } from "../../utils/logger";
import { deleteUserMessage } from "../../services/messageCache";
import { handleLimitReached, isLimitError } from "../helpers";
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
    const response = await axios.post(`${BACKEND_URL}/api/rewrite`, {
      text: originalText,
      tone,
      telegramId: String(userId),
    });

    const { result, remaining, initialLimit, isPremium } = response.data;

    if (isLimitError(response)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    const totalLimit = initialLimit ?? 5;
    const used = remaining !== "∞" ? totalLimit - remaining : 0;

    const attemptsInfo =
      !isPremium && remaining !== "∞"
        ? `\n\n_${used}/${totalLimit} попыток на сегодня_`
        : "";

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      `Вот твой текст в стиле *${toneDisplayName}*:\n\n${result}${attemptsInfo}`,
      { parse_mode: "Markdown" }
    );

    log(`User ${userId} rewrote text in tone "${tone}" (${used}/${totalLimit})`);
    deleteUserMessage(userId);
  } catch (err: any) {
    logError(`Ошибка при переписывании: ${err.message}`);

    if (isLimitError(undefined, err)) {
      await handleLimitReached(ctx, thinkingMsg, userId);
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      thinkingMsg.message_id,
      undefined,
      "⚠️ Что-то пошло не так. Попробуй позже!"
    );
  }
}
