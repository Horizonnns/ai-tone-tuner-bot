import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { openaiClient } from "../services/openai/openaiClient";
import { buildRewriteMessages } from "../services/prompt";
dotenv.config();

export function setupInline(bot: Telegraf) {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query?.trim();
    if (!query) return;

    try {
      const messages = buildRewriteMessages(query, "friendly");
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
      });

      let result = completion.choices[0].message?.content || "Не удалось 😅";
      if (result.length > 512) result = result.slice(0, 509) + "…";

      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "1",
            title: "💬 Переписать в дружелюбном стиле",
            input_message_content: { message_text: result },
            description: "AI Tone Tuner — мгновенная адаптация",
          },
        ],
        { cache_time: 0 }
      );
    } catch (err) {
      console.error("Ошибка inline:", err);
    }
  });
}
