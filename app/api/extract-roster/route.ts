import { NextResponse } from "next/server";
import { extractRosterFromImages } from "@/lib/groq";

const MAX_TOTAL_IMAGES = 15;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const images = (body as { images?: unknown })?.images;
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "Provide at least one image as a base64 data URI." }, { status: 400 });
  }
  if (images.length > MAX_TOTAL_IMAGES) {
    return NextResponse.json({ error: `Too many images — please upload at most ${MAX_TOTAL_IMAGES}.` }, { status: 400 });
  }
  if (!images.every((img) => typeof img === "string" && img.startsWith("data:image/"))) {
    return NextResponse.json({ error: "Every image must be a data:image/... base64 URI." }, { status: 400 });
  }

  try {
    const players = await extractRosterFromImages(images as string[]);
    if (players.length === 0) {
      return NextResponse.json(
        { error: "No players were recognized in these screenshots. Try clearer or less cropped images." },
        { status: 422 }
      );
    }
    return NextResponse.json({ players });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error extracting roster.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
