import { OpenAI } from "openai";

// Singleton instance
let openaiInstance: OpenAI | undefined;

export function getOpenAIInstance(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}
