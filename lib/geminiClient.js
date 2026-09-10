import { GoogleGenerativeAI } from "@google/generative-ai";

let client = null;

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return client;
}

// 用於文字擷取／解析任務的模型：成本較低，速度快，足以應付結構化擷取與即時對話。
export const EXTRACTION_MODEL = "gemini-3.6-flash";
