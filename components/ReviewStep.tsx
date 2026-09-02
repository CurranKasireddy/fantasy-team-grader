"use client";

import type { ExtractedPlayer } from "@/lib/types";

interface Props {
  players: ExtractedPlayer[];
  onPlayersChange: (players: ExtractedPlayer[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export default function ReviewStep({ players, onPlayersChange, onSubmit, onBack, loading, error }: Props) {
  function update(clientId: string, patch: Partial<ExtractedPlayer>) {
    onPlayersChange(players.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)));
  }

  function remove(clientId: string) {
    onPlayersChange(players.filter((p) => p.clientId !== clientId));
  }

  function addPlayer() {
    onPlayersChange([
      ...players,
      {
        clientId: crypto.randomUUID(),
        rawName: "",
        position: "RB",
        nflTeam: null,
        isStarter: false,
        sourceImage: 0,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your roster</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Fix any misread names or positions before grading — this is the model&apos;s best guess from your
          screenshots. Found <span className="font-medium text-foreground">{players.length}</span> player
          {players.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Pos</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Starter</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.clientId} className="border-t border-border hover:bg-surface-muted/60">
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    value={p.rawName}
                    onChange={(e) => update(p.clientId, { rawName: e.target.value })}
                    placeholder="Player name"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    className="rounded-md border border-border bg-surface px-2 py-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    value={POSITIONS.includes(p.position) ? p.position : "RB"}
                    onChange={(e) => update(p.clientId, { position: e.target.value })}
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-16 rounded-md border border-transparent bg-transparent px-2 py-1 uppercase hover:border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    value={p.nflTeam ?? ""}
                    onChange={(e) => update(p.clientId, { nflTeam: e.target.value || null })}
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={p.isStarter}
                    onChange={(e) => update(p.clientId, { isStarter: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove(p.clientId)}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No players yet — add one manually below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addPlayer}
        className="self-start text-sm font-medium text-accent hover:text-accent-hover"
      >
        + add a player manually
      </button>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          Back
        </button>
        <button
          type="button"
          disabled={players.length === 0 || loading}
          onClick={onSubmit}
          className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Grading…" : "Grade my team"}
        </button>
      </div>
    </div>
  );
}
