// Vision extraction: turn roster screenshots into a structured player list
// using Groq's free-tier API (qwen/qwen3.6-27b, vision-capable, up to 5
// images per request). See README for how to get a free Groq API key.
import type { ExtractedPlayer } from "./types";

const GROQ_MODEL = "qwen/qwen3.6-27b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Verified against Groq's vision docs: this model accepts at most 5 images
// per request, so we batch larger uploads into multiple calls.
const MAX_IMAGES_PER_CALL = 5;

const SYSTEM_PROMPT = `You read screenshots of fantasy football team rosters (from apps like Sleeper, ESPN Fantasy, Yahoo Fantasy, or similar) and extract every player visible into structured JSON.

Rules:
- Extract every player row you can see, including bench/reserve players, not just starters.
- "isStarter" is true only if the player is clearly in a starting lineup section (as opposed to a "Bench", "Reserve", "IR", or "Taxi" section). If you cannot tell, use false.
- "position" must be one of: QB, RB, WR, TE, K, DEF (use DEF for team defense/special teams, e.g. "49ers D/ST" -> nflTeam "SF", rawName "SF").
- "nflTeam" is the player's NFL team as a 2-3 letter abbreviation if visible (e.g. "KC", "SF", "DAL"), or null if not shown.
- "sourceImageIndex" is the 0-based index of which image (in the order given) the player was read from.
- Do not invent players that are not visibly present. Do not deduplicate across images — if the same player appears in two images, list them twice; the caller will deduplicate.
- Reply with ONLY a JSON object of the exact shape: {"players": [{"rawName": string, "position": string, "nflTeam": string|null, "isStarter": boolean, "sourceImageIndex": number}]}`;

interface RawExtractedPlayer {
  rawName?: unknown;
  position?: unknown;
  nflTeam?: unknown;
  isStarter?: unknown;
  sourceImageIndex?: unknown;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function coercePlayer(raw: RawExtractedPlayer, imageOffset: number): ExtractedPlayer | null {
  const rawName = typeof raw.rawName === "string" ? raw.rawName.trim() : "";
  if (!rawName) return null;
  const position = typeof raw.position === "string" ? raw.position.trim().toUpperCase() : "UNKNOWN";
  const nflTeam = typeof raw.nflTeam === "string" && raw.nflTeam.trim() ? raw.nflTeam.trim().toUpperCase() : null;
  const isStarter = raw.isStarter === true;
  const localIndex = typeof raw.sourceImageIndex === "number" ? raw.sourceImageIndex : 0;
  return {
    clientId: crypto.randomUUID(),
    rawName,
    position,
    nflTeam,
    isStarter,
    sourceImage: imageOffset + localIndex,
  };
}

function parseRosterJson(text: string, imageOffset: number): ExtractedPlayer[] {
  const cleaned = stripCodeFence(text);
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    throw new Error("Could not parse the roster extraction response as JSON. Try re-uploading clearer screenshots.");
  }
  const players =
    obj && typeof obj === "object" && "players" in obj && Array.isArray((obj as { players: unknown }).players)
      ? ((obj as { players: RawExtractedPlayer[] }).players)
      : [];
  return players
    .map((p) => coercePlayer(p, imageOffset))
    .filter((p): p is ExtractedPlayer => p !== null);
}

async function extractBatch(dataUris: string[], imageOffset: number): Promise<ExtractedPlayer[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to .env.local."
    );
  }

  const content = [
    { type: "text", text: `Extract every player from these ${dataUris.length} roster screenshot(s).` },
    ...dataUris.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_completion_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Groq returned an empty response for roster extraction.");
  }
  return parseRosterJson(raw, imageOffset);
}

/**
 * Extract roster players from one or more screenshot images.
 * @param dataUris Base64 data URIs (e.g. "data:image/jpeg;base64,...") in upload order.
 */
export async function extractRosterFromImages(dataUris: string[]): Promise<ExtractedPlayer[]> {
  if (dataUris.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < dataUris.length; i += MAX_IMAGES_PER_CALL) {
    batches.push(dataUris.slice(i, i + MAX_IMAGES_PER_CALL));
  }

  const results: ExtractedPlayer[] = [];
  let offset = 0;
  for (const batch of batches) {
    const players = await extractBatch(batch, offset);
    results.push(...players);
    offset += batch.length;
  }
  return results;
}
