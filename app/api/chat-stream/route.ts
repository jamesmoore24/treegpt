import { NextResponse } from "next/server";
import { getOpenAIInstance, getDeepSeekInstance } from "@/app/lib/openai";
import { ModelType } from "@/app/components/ChatWindow";
import OpenAI from "openai";
import { type Stream } from "openai/streaming";
import { ModelInfo, TokenUsage } from "@/types/tokenUsage";
import { DeepSeekCompletionUsage, DeepSeekDelta } from "@/types/openai";
import { getCerebrasInstance } from "@/app/lib/openai";

export const dynamic = "force-dynamic";

// Get the model config for the selected model
const modelConfigs: Record<ModelType, string> = {
  "llama-3.1-8b": "Llama 3.1 (8B)",
  "llama-3.3-70b": "Llama 3.3 (70B)",
  "llama-4-scout-17b-16e-instruct": "Llama 4 Scout (17B)",
  "qwen-3-32b": "Qwen 3 (32B)",
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
};

export async function POST(request: Request) {
  try {
    const { messages, model, autoRouteEnabled } = await request.json();

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
    let selectedModel: ModelType = model as ModelType;

    // Handle auto-routing if enabled
    if (autoRouteEnabled) {
      try {
        const lastMessage = messages[messages.length - 1];
        const routerResponse = await fetch("http://localhost:8000/route", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: lastMessage.content,
          }),
        });

        if (!routerResponse.ok) {
          throw new Error("Router service failed");
        }

        const routerResult = await routerResponse.json();
        const complexity = routerResult.win_rate;

        // Use fixed thresholds to determine model
        selectedModel =
          complexity > 0.2
            ? "deepseek-reasoner"
            : complexity > 0.11593
            ? "llama-3.3-70b"
            : "llama-3.1-8b";

        console.log(
          `Auto-routing selected model: ${selectedModel} (complexity: ${complexity})`
        );

        // Send the selected model information in the first chunk
        const firstChunk = {
          selectedModel,
          content: "",
          modelInfo: {
            name: modelConfigs[selectedModel],
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              cached: false,
            },
          },
        };
      } catch (error) {
        console.error("Auto-routing failed, falling back to 8B model:", error);
        selectedModel = "llama-3.1-8b";

        // Send the fallback model information
        const firstChunk = {
          selectedModel,
          content: "",
          modelInfo: {
            name: modelConfigs[selectedModel],
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              cached: false,
            },
          },
        };
      }
    }

    switch (selectedModel) {
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
          name: modelConfigs[selectedModel],
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
          name: modelConfigs[selectedModel],
          usage: {
            inputTokens: estimatedInputTokens70b,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "llama-4-scout-17b-16e-instruct":
        const cerebrasScout = getCerebrasInstance();
        response = (await cerebrasScout.chat.completions.create({
          model: "llama-4-scout-17b-16e-instruct",
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          stream: true,
        })) as unknown as Stream<OpenAI.ChatCompletionChunk>;
        const totalInputContentScout = messages.reduce(
          (acc, msg) => acc + msg.content,
          ""
        );
        const estimatedInputTokensScout = Math.ceil(
          totalInputContentScout.length / 4
        );
        modelInfo = {
          name: modelConfigs[selectedModel],
          usage: {
            inputTokens: estimatedInputTokensScout,
            outputTokens: 0,
            cached: isCached,
          },
        };
        break;

      case "qwen-3-32b":
        const cerebrasQwen = getCerebrasInstance();
        response = (await cerebrasQwen.chat.completions.create({
          model: "qwen-3-32b",
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          stream: true,
        })) as unknown as Stream<OpenAI.ChatCompletionChunk>;
        const totalInputContentQwen = messages.reduce(
          (acc, msg) => acc + msg.content,
          ""
        );
        const estimatedInputTokensQwen = Math.ceil(
          totalInputContentQwen.length / 4
        );
        modelInfo = {
          name: modelConfigs[selectedModel],
          usage: {
            inputTokens: estimatedInputTokensQwen,
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
        let qwenReasoningActive = false;
        let qwenReasoningBuffer = "";
        let qwenReasoningLastPos = 0;
        let qwenContentStarted = false;

        // Send the initial chunk with model information if auto-routing was used
        if (model === "auto") {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                selectedModel,
                content: "",
                modelInfo: {
                  name: modelConfigs[selectedModel],
                  usage: {
                    inputTokens: initialInputTokens,
                    outputTokens: 0,
                    cached: false,
                  },
                },
              }) + "\n"
            )
          );
        }

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta as DeepSeekDelta;
          const text = delta.content || "";
          const reasoning = delta.reasoning_content;
          const usage = chunk.usage as DeepSeekCompletionUsage;

          // Handle reasoning content for DeepSeek Reasoner
          if (selectedModel === "deepseek-reasoner" && reasoning) {
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
                  model: modelInfo.name,
                }) + "\n"
              )
            );
            continue;
          }

          // Stream Qwen <think> reasoning live, only new delta
          if (selectedModel === "qwen-3-32b" && text) {
            let remaining = text;
            while (remaining.length > 0) {
              if (!qwenReasoningActive) {
                // Look for <think>
                const thinkStart = remaining.indexOf("<think>");
                if (thinkStart !== -1) {
                  // Stream any content before <think> as content
                  const before = remaining.slice(0, thinkStart);
                  if (before) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          content: before,
                          reasoning: null,
                          modelInfo,
                          model: modelInfo.name,
                        }) + "\n"
                      )
                    );
                  }
                  qwenReasoningActive = true;
                  remaining = remaining.slice(thinkStart + 7); // skip <think>
                  qwenReasoningBuffer = "";
                  qwenReasoningLastPos = 0;
                  continue;
                }
              }
              if (qwenReasoningActive) {
                // Look for </think>
                const thinkEnd = remaining.indexOf("</think>");
                if (thinkEnd !== -1) {
                  // Stream up to </think> as reasoning (only new part)
                  qwenReasoningBuffer += remaining.slice(0, thinkEnd);
                  const newReasoning =
                    qwenReasoningBuffer.slice(qwenReasoningLastPos);
                  if (newReasoning) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          content: "",
                          reasoning: newReasoning,
                          modelInfo,
                          model: modelInfo.name,
                        }) + "\n"
                      )
                    );
                    qwenReasoningLastPos = qwenReasoningBuffer.length;
                  }
                  qwenReasoningActive = false;
                  qwenContentStarted = true;
                  remaining = remaining.slice(thinkEnd + 8); // skip </think>
                  qwenReasoningBuffer = "";
                  qwenReasoningLastPos = 0;
                  continue;
                } else {
                  // All is reasoning (only new part)
                  qwenReasoningBuffer += remaining;
                  const newReasoning =
                    qwenReasoningBuffer.slice(qwenReasoningLastPos);
                  if (newReasoning) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          content: "",
                          reasoning: newReasoning,
                          modelInfo,
                          model: modelInfo.name,
                        }) + "\n"
                      )
                    );
                    qwenReasoningLastPos = qwenReasoningBuffer.length;
                  }
                  break;
                }
              }
              // If not in <think>, stream as content
              if (!qwenReasoningActive && remaining.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      content: remaining,
                      reasoning: null,
                      modelInfo,
                      model: modelInfo.name,
                    }) + "\n"
                  )
                );
                break;
              }
            }
            continue;
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
                  model: modelInfo.name,
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
