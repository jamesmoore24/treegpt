import { NextResponse } from "next/server";
import { getCerebrasInstance, getDeepSeekInstance } from "@/app/lib/openai";
import { ModelType } from "@/app/components/ChatWindow";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

/**
 * Root LLM call for the multi-turn RLM REPL loop.
 * Accepts a full conversation history and returns the next LLM response.
 */
export async function POST(request: Request) {
  try {
    const { messages, model } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const selectedModel = model as ModelType;
    let response = "";

    if (selectedModel === "deepseek-chat" || selectedModel === "deepseek-reasoner") {
      const deepseek = getDeepSeekInstance();
      const completion = (await deepseek.chat.completions.create({
        model: selectedModel,
        messages,
        temperature: 0.7,
      })) as OpenAI.Chat.ChatCompletion;
      response = completion.choices[0]?.message?.content?.trim() || "";
    } else {
      const cerebras = getCerebrasInstance();
      const completion = (await cerebras.chat.completions.create({
        model: selectedModel,
        messages: messages as any[],
        temperature: 0.7,
      })) as unknown as OpenAI.Chat.ChatCompletion;
      response = completion.choices[0]?.message?.content?.trim() || "";
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[rlm-root-call error]:", error);
    return NextResponse.json({ error: "Internal server error", response: "" }, { status: 500 });
  }
}
