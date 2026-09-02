// Shared types for the roster-grading pipeline.

export type ScoringFormat = "std" | "half_ppr" | "ppr";

export interface LeagueSettings {
  scoring: ScoringFormat;
  /** Number of teams in the league — used for positional-scarcity context. */
  numTeams: number;
  /** Superflex/2QB leagues value QBs much higher. */
  superflex: boolean;
}

export const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  scoring: "half_ppr",
  numTeams: 12,
  superflex: false,
};

/** The set of fantasy positions we know how to grade. */
export type FantasyPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

/** One player as read off a screenshot, before any confirmation/matching. */
export interface ExtractedPlayer {
  /** Client-side id, stable across the review step (not a Sleeper id). */
  clientId: string;
  rawName: string;
  position: FantasyPosition | string;
  nflTeam: string | null;
  isStarter: boolean;
  /** Which uploaded image (0-indexed) this player was read from. */
  sourceImage: number;
}

export interface SleeperPlayerRecord {
  playerId: string;
  fullName: string;
  position: string;
  team: string | null;
  fantasyPositions: string[];
}

export interface GradedPlayer extends ExtractedPlayer {
  sleeperId: string | null;
  matchedName: string | null;
  matchScore: number;
  seasonPoints: number | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  /** Percentile (0-100) vs. other rostered-relevant players at the same position. */
  positionPercentile: number | null;
  grade: string | null;
}

export interface PositionGroupReport {
  position: string;
  grade: string;
  score: number; // 0-100
  players: GradedPlayer[];
}

export interface TeamReport {
  overallGrade: string;
  overallScore: number; // 0-100
  seasonUsed: string;
  positionGroups: PositionGroupReport[];
  strengths: string[];
  weaknesses: string[];
  unmatchedPlayers: GradedPlayer[];
}
