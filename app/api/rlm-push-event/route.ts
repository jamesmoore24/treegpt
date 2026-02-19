import { NextResponse } from "next/server";
import { pushEvent } from "@/app/lib/rlm-sessions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { sessionId, event } = await request.json();
    if (!sessionId || !event) {
      return NextResponse.json(
        { error: "sessionId and event are required" },
        { status: 400 }
      );
    }
    pushEvent(sessionId, event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rlm-push-event error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
