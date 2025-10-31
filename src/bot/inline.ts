import { Telegraf } from "telegraf";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

export function setupInline(bot: Telegraf) {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query;
    if (!query) return;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Перепиши текст в дружелюбном и лёгком тоне:\n\n${query}`,
        },
      ],
    });

    const result = response.choices[0].message?.content || "Не удалось 😅";

    await ctx.answerInlineQuery([
      {
        type: "article",
        id: "1",
        title: "💬 Переписать в дружелюбном стиле",
        input_message_content: { message_text: result },
        description: "Быстрая адаптация текста",
      },
    ]);
  });
}
