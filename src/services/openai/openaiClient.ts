import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const OPENAI_TIMEOUT = 60000; // 60 seconds

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_KEY!,
  timeout: OPENAI_TIMEOUT,
});
