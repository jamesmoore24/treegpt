import { NextResponse } from "next/server";
import { getCerebrasInstance } from "@/app/lib/openai";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { query, response } = await request.json();

    const cerebras = getCerebrasInstance();
    const completion = (await cerebras.chat.completions.create({
      model: "llama-3.3-70b",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates concise chat titles. Keep titles under 50 characters.",
        },
        {
          role: "user",
          content: `Generate a concise title for this chat based on the first query and response:\n\nQuery: ${query}\n\nResponse: ${response}`,
        },
      ],
      temperature: 0.7,
    })) as unknown as OpenAI.Chat.ChatCompletion;

    const summary =
      completion.choices[0]?.message?.content?.trim() || "New Chat";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json({ summary: "New Chat" });
  }
}
