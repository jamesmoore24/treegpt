import { NextResponse } from "next/server";
import { getCerebrasInstance, getDeepSeekInstance } from "@/app/lib/openai";
import { ModelType } from "@/app/components/ChatWindow";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { prompt, context, model } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const selectedModel = model as ModelType;
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (context) {
      messages.push({
        role: "system",
        content: `You are a helpful assistant. Use the following context to answer the question.\n\nContext:\n${context}`,
      });
    }
    messages.push({ role: "user", content: prompt });

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
    console.error("[llm-answer error]:", error);
    return NextResponse.json({ error: "Internal server error", response: "" }, { status: 500 });
  }
}
