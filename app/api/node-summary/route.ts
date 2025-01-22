import { NextResponse } from "next/server";
import { getOpenAIInstance } from "@/app/lib/openai";

export const dynamic = "force-dynamic";

const openai = getOpenAIInstance();

export async function POST(request: Request) {
  const { query, response } = await request.json();
  const summary = await generateBlockSummary(query, response);
  return NextResponse.json({ summary });
}

async function generateBlockSummary(
  query: string,
  response: string
): Promise<string> {
  try {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Summarize the following Q&A exchange in 10 words or less.",
        },
        {
          role: "user",
          content: `Q: ${query}\nA: ${response}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    return (
      summaryResponse.choices[0]?.message?.content || "No summary generated"
    );
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Error generating summary";
  }
}
