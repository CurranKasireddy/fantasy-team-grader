import { NextResponse } from "next/server";
import { getLineupChatReply } from "@/lib/lineup-chat";
import type { ChatMessage, GradedPlayer } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 500;

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const msg = m as Record<string, unknown>;
  return (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string";
}

// Loose check — enough to safely build the chat prompt, not full schema
// validation (the client already produced this from a real TeamReport).
function isValidRosterPlayer(p: unknown): p is GradedPlayer {
  if (!p || typeof p !== "object") return false;
  const player = p as Record<string, unknown>;
  return typeof player.rawName === "string" && typeof player.position === "string";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const messages = (body as { messages?: unknown })?.messages;
  const roster = (body as { roster?: unknown })?.roster;

  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isValidMessage)) {
    return NextResponse.json({ error: "Provide a non-empty list of chat messages." }, { status: 400 });
  }
  const lastMessage = messages[messages.length - 1] as ChatMessage;
  if (lastMessage.role !== "user") {
    return NextResponse.json({ error: "The last message must be from the user." }, { status: 400 });
  }
  if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Keep questions under ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 });
  }
  if (!Array.isArray(roster) || !roster.every(isValidRosterPlayer)) {
    return NextResponse.json({ error: "Invalid roster data." }, { status: 400 });
  }

  try {
    const reply = await getLineupChatReply(messages as ChatMessage[], roster as GradedPlayer[]);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error getting a reply.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
