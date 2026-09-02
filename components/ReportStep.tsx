"use client";

import { useState } from "react";
import PlayerDetailModal from "@/components/PlayerDetailModal";
import type { GradedPlayer, TeamReport } from "@/lib/types";

interface Props {
  report: TeamReport;
  onReset: () => void;
}

type GradeTone = "great" | "good" | "mid" | "weak" | "bad";

function gradeTone(grade: string): GradeTone {
  if (grade.startsWith("A")) return "great";
  if (grade.startsWith("B")) return "good";
  if (grade.startsWith("C")) return "mid";
  if (grade.startsWith("D")) return "weak";
  return "bad";
}

const TONE_TEXT: Record<GradeTone, string> = {
  great: "text-emerald-600 dark:text-emerald-400",
  good: "text-lime-600 dark:text-lime-400",
  mid: "text-amber-600 dark:text-amber-400",
  weak: "text-orange-600 dark:text-orange-400",
  bad: "text-red-600 dark:text-red-400",
};

const TONE_RING: Record<GradeTone, string> = {
  great: "#10b981",
  good: "#84cc16",
  mid: "#f59e0b",
  weak: "#f97316",
  bad: "#ef4444",
};

const TONE_BG: Record<GradeTone, string> = {
  great: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
  good: "bg-lime-50 border-lime-200 dark:bg-lime-950/30 dark:border-lime-900",
  mid: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
  weak: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900",
  bad: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
};

const TONE_BAR: Record<GradeTone, string> = {
  great: "bg-emerald-500",
  good: "bg-lime-500",
  mid: "bg-amber-500",
  weak: "bg-orange-500",
  bad: "bg-red-500",
};

function GradeRing({ grade, score }: { grade: string; score: number }) {
  const tone = gradeTone(grade);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={TONE_RING[tone]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${TONE_TEXT[tone]}`}>{grade}</span>
        <span className="text-[11px] text-muted-foreground">{score}/100</span>
      </div>
    </div>
  );
}

function PlayerRow({ player, onSelect }: { player: GradedPlayer; onSelect: () => void }) {
  const tone = player.grade ? gradeTone(player.grade) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-left first:border-t-0 hover:bg-surface-muted"
    >
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="min-w-0 truncate font-medium">
            {player.sleeperId ? (player.matchedName ?? player.rawName) : player.rawName}
          </span>
          {!player.sleeperId && (
            <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400" title="Couldn't confidently match this player">
              ⚠
            </span>
          )}
          {player.isStarter && (
            <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              starter
            </span>
          )}
        </div>
        {player.positionPercentile !== null && (
          <div className="mt-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${TONE_BAR[tone!]}`}
              style={{ width: `${player.positionPercentile}%` }}
            />
          </div>
        )}
      </div>
      <div className="ml-auto text-right text-xs text-muted-foreground sm:ml-0 sm:shrink-0">
        {player.pointsPerGame !== null ? `${player.pointsPerGame.toFixed(1)} pt/gm` : "no data"}
      </div>
      <div className="w-8 shrink-0 text-right">
        {player.grade && <span className={`text-sm font-semibold ${TONE_TEXT[tone!]}`}>{player.grade}</span>}
      </div>
    </button>
  );
}

export default function ReportStep({ report, onReset }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<GradedPlayer | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <GradeRing grade={report.overallGrade} score={report.overallScore} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on {report.seasonUsed} season stats, weighted toward your starters.
          </p>
        </div>
      </div>

      {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {report.strengths.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="font-medium text-emerald-700 dark:text-emerald-400">Strengths</div>
              <div className="mt-1 text-emerald-800 dark:text-emerald-300">{report.strengths.join(", ")}</div>
            </div>
          )}
          {report.weaknesses.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
              <div className="font-medium text-red-700 dark:text-red-400">Needs attention</div>
              <div className="mt-1 text-red-800 dark:text-red-300">{report.weaknesses.join(", ")}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {report.positionGroups.map((group) => {
          const tone = group.grade !== "N/A" ? gradeTone(group.grade) : null;
          return (
            <div key={group.position} className="overflow-hidden rounded-lg border border-border">
              <div
                className={
                  "flex items-center justify-between border-b border-border px-4 py-2 " +
                  (tone ? TONE_BG[tone] : "bg-surface-muted")
                }
              >
                <span className="font-medium">{group.position}</span>
                <span className={`font-bold ${tone ? TONE_TEXT[tone] : "text-muted-foreground"}`}>
                  {group.grade}
                </span>
              </div>
              <div>
                {group.players.map((p) => (
                  <PlayerRow key={p.clientId} player={p} onSelect={() => setSelectedPlayer(p)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {report.unmatchedPlayers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="font-medium text-amber-700 dark:text-amber-400">
            Couldn&apos;t confidently match {report.unmatchedPlayers.length} player
            {report.unmatchedPlayers.length === 1 ? "" : "s"}
          </div>
          <div className="mt-1 text-amber-800 dark:text-amber-300">
            {report.unmatchedPlayers.map((p) => p.rawName).join(", ")} — excluded from grading. Double-check the
            spelling on the review step and try again.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="self-start rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
      >
        Start over
      </button>

      {selectedPlayer && <PlayerDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}
