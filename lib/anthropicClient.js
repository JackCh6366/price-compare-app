import Anthropic from "@anthropic-ai/sdk";

let client = null;

export function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// 用於文字擷取／解析任務的模型：成本較低，速度快，足以應付結構化擷取。
export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
