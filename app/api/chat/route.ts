import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { StreamingTextResponse } from 'ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Make parallel API calls to different models
    const [responseA, responseB] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4",
        messages,
        temperature: 0.7,
        stream: true,
      }),
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        stream: true,
      })
    ]);

    // Create a combined stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // Process both streams in parallel
        await Promise.all([
          (async () => {
            for await (const chunk of responseA) {
              const text = chunk.choices[0]?.delta?.content || "";
              controller.enqueue(encoder.encode(JSON.stringify({
                side: 'left',
                content: text,
                modelInfo: {
                  name: "GPT-4",
                  percentage: 75
                }
              }) + '\n'));
            }
          })(),
          (async () => {
            for await (const chunk of responseB) {
              const text = chunk.choices[0]?.delta?.content || "";
              controller.enqueue(encoder.encode(JSON.stringify({
                side: 'right',
                content: text,
                modelInfo: {
                  name: "GPT-3.5",
                  percentage: 25
                }
              }) + '\n'));
            }
          })()
        ]);
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
    
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
