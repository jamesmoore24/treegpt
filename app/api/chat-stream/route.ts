import { NextResponse } from "next/server";
import { getOpenAIInstance, getDeepSeekInstance } from "@/app/lib/openai";
import { ModelType } from "@/app/components/ChatWindow";
import OpenAI from "openai";
import { type Stream } from "openai/streaming";
import { ModelInfo, TokenUsage } from "@/types/tokenUsage";
import { DeepSeekCompletionUsage, DeepSeekDelta } from "@/types/openai";
import { getCerebrasInstance } from "@/app/lib/openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { messages, model } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Add system message for LaTeX formatting
    const systemMessage = {
      role: "system",
      content:
        "When writing mathematical expressions or equations, always use LaTeX/Markdown formatting with the following conventions:\n- For inline math, use single dollar signs: $x^2 + y^2 = z^2$\n- For block/display math, use double dollar signs:\n$$\n\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\n$$\nThis ensures proper rendering and consistent formatting across all mathematical content.",
    };

    const messagesWithSystem = [systemMessage, ...messages];

    let response: Stream<OpenAI.ChatCompletionChunk>;
    let modelInfo: ModelInfo;
    let isCached = false;

    switch (model as ModelType) {
      case "deepseek-chat":
        const deepseekChat = getDeepSeekInstance();
        response = await deepseekChat.chat.completions.create({
          model: "deepseek-chat",
          messages: messagesWithSystem,
          temperature: 0.7,
          stream: true,
        });
        modelInfo = {
          name: "DeepSeek Chat",
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "deepseek-reasoner":
        const deepseekReasoner = getDeepSeekInstance();
        response = await deepseekReasoner.chat.completions.create({
          model: "deepseek-reasoner",
          messages: messagesWithSystem,
          temperature: 0.7,
          stream: true,
        });
        const totalInputContent = messages.reduce(
          (acc, msg) => acc + msg.content,
          ""
        );
        const estimatedInputTokens = Math.ceil(totalInputContent.length / 4);
        modelInfo = {
          name: "DeepSeek Reasoner",
          usage: {
            inputTokens: estimatedInputTokens,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "llama-3.1-8b":
        const cerebras8b = getCerebrasInstance();
        response = (await cerebras8b.chat.completions.create({
          model: "llama-3.1-8b",
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          stream: true,
        })) as unknown as Stream<OpenAI.ChatCompletionChunk>;
        const totalInputContent8b = messages.reduce(
          (acc, msg) => acc + msg.content,
          ""
        );
        const estimatedInputTokens8b = Math.ceil(
          totalInputContent8b.length / 4
        );
        modelInfo = {
          name: "Llama 3.1 (8B)",
          usage: {
            inputTokens: estimatedInputTokens8b,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "llama-3.3-70b":
        const cerebras70b = getCerebrasInstance();
        response = (await cerebras70b.chat.completions.create({
          model: "llama-3.3-70b",
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          stream: true,
        })) as unknown as Stream<OpenAI.ChatCompletionChunk>;
        const totalInputContent70b = messages.reduce(
          (acc, msg) => acc + msg.content,
          ""
        );
        const estimatedInputTokens70b = Math.ceil(
          totalInputContent70b.length / 4
        );
        modelInfo = {
          name: "Llama 3.3 (70B)",
          usage: {
            inputTokens: estimatedInputTokens70b,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid model specified" },
          { status: 400 }
        );
    }

    // Create stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let outputTokens = 0;
        let reasoningTokens = 0;
        let reasoningContent = "";
        const initialInputTokens = modelInfo.usage.inputTokens;

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta as DeepSeekDelta;
          const text = delta.content || "";
          const reasoning = delta.reasoning_content;
          const usage = chunk.usage as DeepSeekCompletionUsage;

          // Handle reasoning content for DeepSeek Reasoner
          if (model === "deepseek-reasoner" && reasoning) {
            reasoningContent += reasoning;
            reasoningTokens += Math.ceil(reasoning.length / 4);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  content: "",
                  reasoning: reasoning,
                  modelInfo: {
                    ...modelInfo,
                    usage: {
                      ...modelInfo.usage,
                      inputTokens: initialInputTokens,
                      outputTokens: outputTokens + reasoningTokens,
                      reasoningTokens,
                    },
                  },
                }) + "\n"
              )
            );
          }

          // Handle regular content
          if (text) {
            outputTokens += Math.ceil(text.length / 4);

            if (usage) {
              modelInfo.usage = {
                ...modelInfo.usage,
                inputTokens: usage.prompt_tokens || initialInputTokens,
                outputTokens: outputTokens + reasoningTokens,
                cached: (usage.prompt_cache_hit_tokens || 0) > 0,
                totalTokens: usage.total_tokens || 0,
                reasoningTokens,
                cacheHitTokens: usage.prompt_cache_hit_tokens || 0,
                cacheMissTokens: usage.prompt_cache_miss_tokens || 0,
              };
            } else {
              modelInfo.usage = {
                ...modelInfo.usage,
                inputTokens: initialInputTokens,
                outputTokens: outputTokens + reasoningTokens,
                reasoningTokens,
              };
            }

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  content: text,
                  reasoning: null,
                  modelInfo,
                }) + "\n"
              )
            );
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
