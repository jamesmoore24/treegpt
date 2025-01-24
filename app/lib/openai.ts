import { OpenAI } from "openai";

// Singleton instance
let openaiInstance: OpenAI | undefined;
let deepSeekInstance: OpenAI | undefined;

export function getOpenAIInstance(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export function getDeepSeekInstance(): OpenAI {
  if (!deepSeekInstance) {
    deepSeekInstance = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return deepSeekInstance;
}
