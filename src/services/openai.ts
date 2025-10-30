import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY! });

export async function rewriteText(text: string, tone: string) {
  const prompt = `
  Перепиши текст в ${tone}-тоне.
  Сохрани смысл, добавь выразительности и естественности.
  Текст: "${text}"
  `;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message?.content?.trim() || "";
}
