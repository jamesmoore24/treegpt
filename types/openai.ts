import OpenAI from "openai";

export interface DeepSeekCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface DeepSeekDelta {
  content?: string;
  reasoning_content?: string;
}

declare module "openai" {
  interface ChatCompletionChunk {
    choices: {
      delta: DeepSeekDelta;
      index: number;
      finish_reason: string | null;
    }[];
    id: string;
    object: string;
    created: number;
    model: string;
    usage?: DeepSeekCompletionUsage;
  }
}
