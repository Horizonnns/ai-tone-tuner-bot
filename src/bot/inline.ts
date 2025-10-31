import { Telegraf } from "telegraf";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

export function setupInline(bot: Telegraf) {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query?.trim();
    if (!query) return;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Перепиши текст в дружелюбном и лёгком тоне:\n\n${query}`,
          },
        ],
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
            description: "AI Tone Writer — мгновенная адаптация",
          },
        ],
        { cache_time: 0 }
      );
    } catch (err) {
      console.error("Ошибка inline:", err);
    }
  });
}
