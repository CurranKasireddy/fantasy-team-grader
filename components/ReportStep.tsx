"use client";

import type { TeamReport } from "@/lib/types";

interface Props {
  report: TeamReport;
  onReset: () => void;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-600 dark:text-emerald-400";
  if (grade.startsWith("B")) return "text-lime-600 dark:text-lime-400";
  if (grade.startsWith("C")) return "text-amber-600 dark:text-amber-400";
  if (grade.startsWith("D")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export default function ReportStep({ report, onReset }: Props) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team report</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Based on {report.seasonUsed} season stats, weighted toward your starters.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-bold ${gradeColor(report.overallGrade)}`}>{report.overallGrade}</div>
          <div className="text-xs text-zinc-400">{report.overallScore}/100</div>
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

      <div className="flex flex-col gap-4">
        {report.positionGroups.map((group) => (
          <div key={group.position} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <span className="font-medium">{group.position}</span>
              <span className={`font-semibold ${gradeColor(group.grade)}`}>{group.grade}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {group.players.map((p) => (
                  <tr key={p.clientId} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-900">
                    <td className="px-4 py-1.5">
                      {p.matchedName ?? p.rawName}
                      {p.isStarter && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          starter
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-right text-zinc-500">
                      {p.pointsPerGame !== null ? `${p.pointsPerGame.toFixed(1)} pt/gm` : "no data"}
                    </td>
                    <td className="w-16 px-4 py-1.5 text-right text-zinc-400">
                      {p.positionPercentile !== null ? `${p.positionPercentile}th pctl` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
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
        className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
      >
        Start over
      </button>
    </div>
  );
}
