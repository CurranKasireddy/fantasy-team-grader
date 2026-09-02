import { NextResponse } from "next/server";
import { getAllPlayers, getBestAvailableSeasonStats, matchPlayer } from "@/lib/sleeper";
import { buildTeamReport, percentileRank } from "@/lib/grading";
import type { ExtractedPlayer, GradedPlayer, LeagueSettings } from "@/lib/types";

function isValidSettings(s: unknown): s is LeagueSettings {
  if (!s || typeof s !== "object") return false;
  const settings = s as Record<string, unknown>;
  return (
    (settings.scoring === "std" || settings.scoring === "half_ppr" || settings.scoring === "ppr") &&
    typeof settings.numTeams === "number" &&
    typeof settings.superflex === "boolean"
  );
}

function isValidPlayer(p: unknown): p is ExtractedPlayer {
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

  const players = (body as { players?: unknown })?.players;
  const settings = (body as { settings?: unknown })?.settings;

  if (!Array.isArray(players) || players.length === 0 || !players.every(isValidPlayer)) {
    return NextResponse.json({ error: "Provide a non-empty list of players to grade." }, { status: 400 });
  }
  if (!isValidSettings(settings)) {
    return NextResponse.json({ error: "Invalid or missing league settings." }, { status: 400 });
  }

  try {
    const allPlayers = await getAllPlayers();
    const { season, statsByPlayerId } = await getBestAvailableSeasonStats(settings.scoring);

    // Build a per-position points-per-game distribution to grade against.
    const positionOf = new Map(allPlayers.map((p) => [p.playerId, p.position]));
    const distributions = new Map<string, number[]>();
    for (const [playerId, stat] of statsByPlayerId) {
      if (stat.gamesPlayed <= 0) continue;
      const position = positionOf.get(playerId);
      if (!position) continue;
      const ppg = stat.points / stat.gamesPlayed;
      const list = distributions.get(position) ?? [];
      list.push(ppg);
      distributions.set(position, list);
    }
    for (const list of distributions.values()) list.sort((a, b) => a - b);

    const gradedPlayers: GradedPlayer[] = (players as ExtractedPlayer[]).map((extracted) => {
      const match = matchPlayer(extracted.rawName, extracted.position, extracted.nflTeam, allPlayers);
      const stat = match.sleeperId ? statsByPlayerId.get(match.sleeperId) : undefined;
      const pointsPerGame = stat && stat.gamesPlayed > 0 ? stat.points / stat.gamesPlayed : null;
      const distribution = distributions.get(extracted.position.toUpperCase());
      const positionPercentile =
        pointsPerGame !== null && distribution ? percentileRank(distribution, pointsPerGame) : null;

      return {
        ...extracted,
        sleeperId: match.sleeperId,
        matchedName: match.matchedName,
        matchScore: match.matchScore,
        seasonPoints: stat?.points ?? null,
        gamesPlayed: stat?.gamesPlayed ?? null,
        pointsPerGame,
        positionPercentile,
        grade: null, // set at the position-group level, not per player
      };
    });

    const report = buildTeamReport(gradedPlayers, settings, season);
    return NextResponse.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error grading team.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
