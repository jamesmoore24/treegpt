import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dynamically import pdf-parse (externalized from webpack bundle)
    let text = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(buffer);
      text = result.text;
    } catch {
      // Fallback: naive text extraction from PDF bytes
      // Looks for text between BT/ET markers (works for many simple PDFs)
      const raw = buffer.toString("latin1");
      const matches = raw.match(/BT[\s\S]*?ET/g) || [];
      text = matches
        .map((block) => {
          const parts = block.match(/\(([^)]+)\)\s*Tj/g) || [];
          return parts.map((p) => p.replace(/^\(/, "").replace(/\)\s*Tj$/, "")).join(" ");
        })
        .join("\n")
        .trim();

      if (!text) {
        return NextResponse.json(
          { error: "Could not extract text from PDF. Install pdf-parse: npm install pdf-parse" },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error("PDF extract error:", error);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
