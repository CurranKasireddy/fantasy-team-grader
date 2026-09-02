// Vision extraction: turn roster screenshots into a structured player list
// using Groq's free-tier API (qwen/qwen3.6-27b, vision-capable). See README
// for how to get a free Groq API key.
import type { ExtractedPlayer } from "./types";

const GROQ_MODEL = "qwen/qwen3.6-27b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// One image per call: this model spends a chunk of its output budget on
// hidden chain-of-thought reasoning before the actual JSON (confirmed live —
// completion_tokens_details.reasoning_tokens was a real chunk of
// completion_tokens in testing), and a busy real roster screenshot needs a
// lot more of that thinking than a simple one — enough to truncate the
// player list before it finished on multi-image batches. One image per call
// leaves the most budget for both.
const MAX_IMAGES_PER_CALL = 1;
const MAX_COMPLETION_TOKENS = 3000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parses either a plain-seconds string ("22.3") or a Go-style duration
 * string ("2m59.56s", "7.66s") as used by Groq's rate-limit headers. */
function parseDelaySeconds(value: string | null): number | null {
  if (!value) return null;
  const plain = Number(value);
  if (!Number.isNaN(plain)) return plain;
  const match = value.match(/^(?:(\d+)m)?(?:([\d.]+)s)?$/);
  if (match && (match[1] || match[2])) {
    return (match[1] ? Number(match[1]) * 60 : 0) + (match[2] ? Number(match[2]) : 0);
  }
  return null;
}

const SYSTEM_PROMPT = `You read screenshots of fantasy football team rosters (from apps like Sleeper, ESPN Fantasy, Yahoo Fantasy, or similar) and extract every player visible into structured JSON.

Rules:
- Extract every player row you can see, including bench/reserve players, not just starters.
- "isStarter" is true only if the player is clearly in a starting lineup section (as opposed to a "Bench", "Reserve", "IR", or "Taxi" section). If you cannot tell, use false.
- "position" must be one of: QB, RB, WR, TE, K, DEF (use DEF for team defense/special teams, e.g. "49ers D/ST" -> nflTeam "SF", rawName "SF").
- "nflTeam" is the player's NFL team as a 2-3 letter abbreviation if visible (e.g. "KC", "SF", "DAL"), or null if not shown.
- "sourceImageIndex" is the 0-based index of which image (in the order given) the player was read from.
- Do not invent players that are not visibly present. Within a single image, a real roster screenshot lists each player row exactly once — if you think you see the same name twice in the same image, look again, that is almost always a misread, not a genuine repeat, so only list it once. (Across two *separate* uploaded images, the same player legitimately can appear twice — e.g. cropped/overlapping screenshots — and both should be listed, one per image.)
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

// Safety net for vision hallucination (observed in testing: the model can
// mistakenly "see" a repeated block of rows within one image and duplicate
// every player). A real screenshot never legitimately lists the same
// name+position twice within a single image, so collapse those rather than
// relying on prompt wording alone.
function dedupeWithinEachImage(players: ExtractedPlayer[]): ExtractedPlayer[] {
  const seen = new Set<string>();
  const result: ExtractedPlayer[] = [];
  for (const p of players) {
    const key = `${p.sourceImage}|${p.rawName.trim().toLowerCase()}|${p.position}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  return result;
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
  const coerced = players
    .map((p) => coercePlayer(p, imageOffset))
    .filter((p): p is ExtractedPlayer => p !== null);
  return dedupeWithinEachImage(coerced);
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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      }),
    });

    if (res.status === 429) {
      const waitSeconds =
        parseDelaySeconds(res.headers.get("retry-after")) ??
        parseDelaySeconds(res.headers.get("x-ratelimit-reset-tokens")) ??
        5 * (attempt + 1);
      if (attempt < MAX_RETRIES) {
        await sleep(waitSeconds * 1000 + 250);
        continue;
      }
      throw new Error(
        `Groq's free-tier rate limit is exhausted for now. Wait ~${Math.ceil(waitSeconds)}s and try again with fewer screenshots at once.`
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // Per Groq's own guidance, this is an occasional/transient failure —
      // worth a quick retry before giving up.
      const isTransientJsonFailure = errText.includes("json_validate_failed");
      if (isTransientJsonFailure && attempt < MAX_RETRIES) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("Groq returned an empty response for roster extraction.");
    }
    return parseRosterJson(raw, imageOffset);
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error("Groq roster extraction failed after retries.");
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
