// Start/sit chat: a conversational wrapper around data we already compute
// during grading (season grade, this week's matchup/projection, injury
// status) — no new data source, just an LLM reasoning over it in plain
// language, scoped to the user's own roster.
import { parseDelaySeconds, sleep } from "./groq-shared";
import type { ChatMessage, GradedPlayer } from "./types";

const GROQ_MODEL = "qwen/qwen3.6-27b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// reasoning_effort: "none" — tried leaving reasoning on first and hit the
// same failure class as the vision extraction fix, in a worse form: with no
// response_format, the model's raw <think>...</think> block leaked straight
// into the visible reply; retrying with reasoning_format: "hidden" instead
// just burned the whole token budget on invisible reasoning and returned an
// EMPTY reply. Disabling reasoning outright (confirmed live) gives a
// direct, clean, still well-cited answer in a fraction of the tokens.
const MAX_COMPLETION_TOKENS = 700;
const MAX_RETRIES = 3;
// Keep the context small and predictable — this is quick lineup advice, not
// a long-running research conversation.
const MAX_HISTORY_MESSAGES = 12;

function describePlayer(p: GradedPlayer): string {
  const name = p.matchedName ?? p.rawName;
  const parts: string[] = [`${name} — ${p.position}${p.nflTeam ? ` (${p.nflTeam})` : ""}, ${p.isStarter ? "starter" : "bench"}`];

  if (p.grade && p.pointsPerGame !== null) {
    parts.push(
      `season grade ${p.grade} (${p.positionPercentile}th percentile at the position, ${p.pointsPerGame.toFixed(1)} pt/gm over ${p.gamesPlayed} games)`
    );
  } else {
    parts.push("no season stats available");
  }

  if (p.weeklyMatchup) {
    const { week, opponent, projectedPoints } = p.weeklyMatchup;
    parts.push(
      `Week ${week}${opponent ? ` vs ${opponent}` : ""}: ${
        projectedPoints !== null ? `${projectedPoints.toFixed(1)} projected points` : "no projection published yet"
      }`
    );
  } else {
    parts.push("no matchup data available");
  }

  if (p.injuryStatus) {
    parts.push(
      `INJURY: ${p.injuryStatus}${p.injuryBodyPart ? ` (${p.injuryBodyPart})` : ""}${p.injuryNotes ? ` — ${p.injuryNotes}` : ""}`
    );
  }

  return `- ${parts.join("; ")}`;
}

function buildSystemPrompt(roster: GradedPlayer[]): string {
  const matched = roster.filter((p) => p.sleeperId);
  const rosterLines = matched.length > 0 ? matched.map(describePlayer).join("\n") : "(no matched players)";

  return `You are a fantasy football assistant helping with start/sit and lineup decisions for ONE specific team. Its full roster — with real season stats, this week's matchup/projection, and injury status — is listed below. This is the complete, authoritative set of data you have access to.

ROSTER:
${rosterLines}

Rules:
- Only ever discuss players from this list. Never invent a player, stat, or projection that isn't given above. If asked about a player not listed, say you don't have data on them.
- Ground every recommendation in the specific numbers above (projected points, matchup, season grade, injury status) and cite them briefly.
- Give a clear recommendation, not just "it depends" — but be upfront about real uncertainty (missing projection, "Questionable" tag) when it applies.
- Keep answers conversational and concise: a few sentences, not an essay.`;
}

export async function getLineupChatReply(messages: ChatMessage[], roster: GradedPlayer[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to .env.local."
    );
  }
  if (messages.length === 0) {
    throw new Error("No messages to respond to.");
  }

  const trimmedHistory = messages.slice(-MAX_HISTORY_MESSAGES);
  const requestBody = {
    model: GROQ_MODEL,
    messages: [{ role: "system", content: buildSystemPrompt(roster) }, ...trimmedHistory],
    temperature: 0.4,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: "none",
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
        `Groq's free-tier rate limit is exhausted for now. Wait ~${Math.ceil(waitSeconds)}s and try again.`
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Groq returned an empty response.");
    }
    return reply.trim();
  }

  throw new Error("Lineup chat failed after retries.");
}
