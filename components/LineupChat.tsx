"use client";

import { useState } from "react";
import type { ChatMessage, GradedPlayer } from "@/lib/types";

interface Props {
  roster: GradedPlayer[];
}

const SUGGESTED_PROMPTS = [
  "Who should I start at RB this week?",
  "Any injury concerns on my roster?",
  "Who has the best matchup this week?",
];

export default function LineupChat({ roster }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lineup-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, roster }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get a reply.");
      setMessages([...nextMessages, { role: "assistant", content: data.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border">
      <div className="border-b border-border px-4 py-2">
        <h2 className="font-medium">Ask about your lineup</h2>
        <p className="text-xs text-muted-foreground">Start/sit questions, answered from your actual roster data above.</p>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => send(prompt)}
              className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-muted"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto px-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                  (m.role === "user" ? "bg-accent text-accent-foreground" : "bg-surface-muted")
                }
              >
                {m.content}
              </p>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mx-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Should I start Jerome Ford over my WR3?"
          maxLength={500}
          disabled={loading}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
