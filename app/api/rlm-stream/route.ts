import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RLM_SERVICE_URL = process.env.RLM_SERVICE_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const { prompt, model, contextText } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    console.log(
      `[rlm-stream] forwarding to RLM service — model=${model} contextLen=${contextText?.length ?? 0}`
    );

    const serviceRes = await fetch(`${RLM_SERVICE_URL}/rlm-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
        context: contextText || "",
      }),
    });

    if (!serviceRes.ok || !serviceRes.body) {
      const err = await serviceRes.text().catch(() => "unknown error");
      console.error("[rlm-stream] service error:", err);
      return NextResponse.json(
        { error: `RLM service unavailable: ${err}` },
        { status: 502 }
      );
    }

    // Pipe the NDJSON event stream directly from the Python service to the browser
    return new NextResponse(serviceRes.body, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[rlm-stream] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
