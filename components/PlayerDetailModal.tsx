"use client";

import { useEffect } from "react";
import type { GradedPlayer } from "@/lib/types";

interface Props {
  player: GradedPlayer;
  onClose: () => void;
}

function gradeTextColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-600 dark:text-emerald-400";
  if (grade.startsWith("B")) return "text-lime-600 dark:text-lime-400";
  if (grade.startsWith("C")) return "text-amber-600 dark:text-amber-400";
  if (grade.startsWith("D")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export default function PlayerDetailModal({ player, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const name = player.sleeperId ? (player.matchedName ?? player.rawName) : player.rawName;
  const hasInjury = Boolean(player.injuryStatus);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} details`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">
              {player.position}
              {player.nflTeam ? ` · ${player.nflTeam}` : ""}
              {player.isStarter ? " · Starter" : " · Bench"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"
          >
            ×
          </button>
        </div>

        {!player.sleeperId ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            Couldn&apos;t confidently match this player to a real NFL player, so there&apos;s no stats/matchup data
            to show. Double check the spelling on the review step.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Health</h3>
              {hasInjury ? (
                <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  {player.injuryStatus}
                  {player.injuryBodyPart ? ` — ${player.injuryBodyPart}` : ""}
                  {player.injuryNotes ? `. ${player.injuryNotes}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-foreground">No reported injury.</p>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Next matchup
              </h3>
              {player.weeklyMatchup ? (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>
                    Week {player.weeklyMatchup.week}
                    {player.weeklyMatchup.opponent ? ` vs ${player.weeklyMatchup.opponent}` : ""}
                  </span>
                  <span className="font-medium">
                    {player.weeklyMatchup.projectedPoints !== null
                      ? `${player.weeklyMatchup.projectedPoints.toFixed(1)} proj`
                      : "no projection yet"}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No matchup data available yet.</p>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Season so far
              </h3>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span>
                  {player.pointsPerGame !== null
                    ? `${player.pointsPerGame.toFixed(1)} pt/gm over ${player.gamesPlayed} games`
                    : "No stats yet this season"}
                </span>
                {player.grade && (
                  <span className={`font-bold ${gradeTextColor(player.grade)}`}>{player.grade}</span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
