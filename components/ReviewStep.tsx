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
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your roster</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fix any misread names or positions before grading — this is the model&apos;s best guess from your screenshots.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Starter</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.clientId} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-zinc-300 focus:border-zinc-400 dark:hover:border-zinc-700"
                    value={p.rawName}
                    onChange={(e) => update(p.clientId, { rawName: e.target.value })}
                    placeholder="Player name"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    className="rounded border border-zinc-300 bg-transparent px-1.5 py-1 dark:border-zinc-700"
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
                    className="w-16 rounded border border-transparent bg-transparent px-1.5 py-1 uppercase hover:border-zinc-300 focus:border-zinc-400 dark:hover:border-zinc-700"
                    value={p.nflTeam ?? ""}
                    onChange={(e) => update(p.clientId, { nflTeam: e.target.value || null })}
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={p.isStarter}
                    onChange={(e) => update(p.clientId, { isStarter: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove(p.clientId)}
                    className="text-xs text-zinc-400 hover:text-red-500"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addPlayer} className="self-start text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        + add a player manually
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Back
        </button>
        <button
          type="button"
          disabled={players.length === 0 || loading}
          onClick={onSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Grading…" : "Grade my team"}
        </button>
      </div>
    </div>
  );
}
