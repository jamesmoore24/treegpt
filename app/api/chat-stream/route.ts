import { NextResponse } from "next/server";
import { getOpenAIInstance, getDeepSeekInstance } from "@/app/lib/openai";
import { ModelType } from "@/app/components/ChatWindow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { messages, model, showReasoning } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    let response;
    let modelInfo;
    let isCached = false; // We'll need to implement cache detection logic

    switch (model as ModelType) {
      case "gpt-4":
        const openai = getOpenAIInstance();
        response = await openai.chat.completions.create({
          model: "gpt-4",
          messages,
          temperature: 0.7,
          stream: true,
        });
        modelInfo = {
          name: "GPT-4",
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "deepseek-chat":
        const deepseekChat = getDeepSeekInstance();
        response = await deepseekChat.chat.completions.create({
          model: "deepseek-chat",
          messages,
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
          messages,
          temperature: 0.7,
          stream: true,
        });
        modelInfo = {
          name: "DeepSeek Reasoner",
          usage: {
            inputTokens: 0,
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

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || "";
          const reasoning = chunk.choices[0]?.delta?.reasoning_content;

          // Handle reasoning content for DeepSeek Reasoner
          if (model === "deepseek-reasoner" && reasoning && showReasoning) {
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
                      outputTokens: outputTokens + reasoningTokens,
                    },
                  },
                }) + "\n"
              )
            );
          }

          // Handle regular content
          if (text) {
            outputTokens += Math.ceil(text.length / 4);

            if (chunk.usage) {
              modelInfo.usage = {
                ...modelInfo.usage,
                inputTokens: chunk.usage.prompt_tokens || 0,
                outputTokens: outputTokens + reasoningTokens,
                cached: chunk.usage.prompt_cache_hit_tokens > 0,
                totalTokens: chunk.usage.total_tokens || 0,
                reasoningTokens: reasoningTokens,
                cacheHitTokens: chunk.usage.prompt_cache_hit_tokens || 0,
                cacheMissTokens: chunk.usage.prompt_cache_miss_tokens || 0,
              };
            } else {
              modelInfo.usage = {
                ...modelInfo.usage,
                outputTokens: outputTokens + reasoningTokens,
                reasoningTokens: reasoningTokens,
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
