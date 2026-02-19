import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "treegpt.app";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const siteUrl = `${proto}://${host}`;

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(siteUrl);
}
