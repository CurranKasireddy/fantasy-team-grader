// Turns matched/stat-joined roster players into percentile-based grades.
// Percentiles are computed against the real league-wide distribution of
// players at each position (not just the user's own roster, which would be
// too small a sample to mean anything).
import type { GradedPlayer, LeagueSettings, PositionGroupReport, TeamReport } from "./types";

const GRADE_THRESHOLDS: [number, string][] = [
  [97, "A+"], [93, "A"], [90, "A-"],
  [87, "B+"], [83, "B"], [80, "B-"],
  [77, "C+"], [73, "C"], [70, "C-"],
  [67, "D+"], [63, "D"], [60, "D-"],
];

export function letterGrade(percentile: number): string {
  for (const [min, grade] of GRADE_THRESHOLDS) {
    if (percentile >= min) return grade;
  }
  return "F";
}

/** Percentile (0-100) of `value` within a sorted-ascending distribution. */
export function percentileRank(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) return 50; // no reference data — stay neutral
  let below = 0;
  for (const v of sortedAsc) {
    if (v < value) below++;
    else break;
  }
  return Math.round((below / sortedAsc.length) * 100);
}

const STARTER_WEIGHT = 2;
const BENCH_WEIGHT = 1;

function weightedAverage(values: { value: number; weight: number }[]): number {
  const totalWeight = values.reduce((s, v) => s + v.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight;
}

export function buildPositionGroups(players: GradedPlayer[]): PositionGroupReport[] {
  const byPosition = new Map<string, GradedPlayer[]>();
  for (const p of players) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }

  const groups: PositionGroupReport[] = [];
  for (const [position, group] of byPosition) {
    const graded = group.filter((p) => p.positionPercentile !== null);
    const score =
      graded.length > 0
        ? weightedAverage(
            graded.map((p) => ({
              value: p.positionPercentile as number,
              weight: p.isStarter ? STARTER_WEIGHT : BENCH_WEIGHT,
            }))
          )
        : 0;
    groups.push({
      position,
      grade: graded.length > 0 ? letterGrade(score) : "N/A",
      score: Math.round(score),
      players: group,
    });
  }

  const order = ["QB", "RB", "WR", "TE", "K", "DEF"];
  groups.sort((a, b) => {
    const ia = order.indexOf(a.position);
    const ib = order.indexOf(b.position);
    if (ia === -1 && ib === -1) return a.position.localeCompare(b.position);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return groups;
}

export function buildTeamReport(
  players: GradedPlayer[],
  settings: LeagueSettings,
  seasonUsed: string
): TeamReport {
  const positionGroups = buildPositionGroups(players);
  const unmatchedPlayers = players.filter((p) => p.sleeperId === null);

  const graded = players.filter((p) => p.positionPercentile !== null);
  const overallScore = Math.round(
    weightedAverage(
      graded.map((p) => ({
        value: p.positionPercentile as number,
        weight: p.isStarter ? STARTER_WEIGHT : BENCH_WEIGHT,
      }))
    )
  );

  const gradedGroups = positionGroups.filter((g) => g.grade !== "N/A");
  const strengths = gradedGroups.filter((g) => g.score >= 80).map((g) => `${g.position} (${g.grade})`);
  const weaknesses = gradedGroups.filter((g) => g.score < 60).map((g) => `${g.position} (${g.grade})`);

  // Note: `settings.superflex` isn't factored in yet — a superflex league
  // values a 2nd/3rd QB far more than plain position-percentile captures.
  // Flagged as a known MVP limitation in the README rather than silently
  // mis-grading those rosters.
  void settings;

  return {
    overallGrade: graded.length > 0 ? letterGrade(overallScore) : "N/A",
    overallScore,
    seasonUsed,
    positionGroups,
    strengths,
    weaknesses,
    unmatchedPlayers,
  };
}
