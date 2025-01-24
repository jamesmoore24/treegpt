export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  totalTokens?: number;
  reasoningTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
}
