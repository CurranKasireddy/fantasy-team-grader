// Sleeper API access: player identity DB + season stats, both public/no-auth.
// The full player list is ~15MB and Sleeper's own docs ask that it be fetched
// at most once a day, so we cache both endpoints to disk.
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { ScoringFormat, SleeperPlayerRecord, WeeklyMatchup } from "./types";

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const STATE_URL = "https://api.sleeper.app/v1/state/nfl";
// Note: the stats and projections endpoints live on a different subdomain
// (api.sleeper.com, not .app) — undocumented, but verified live against the
// real API, including that per-week entries (unlike season totals) carry an
// "opponent" field, and that a real (Rotowire-sourced) projections endpoint
// exists at the same URL shape as stats.
const STATS_URL = (season: string) => `https://api.sleeper.com/stats/nfl/${season}?season_type=regular`;
const PROJECTIONS_URL = (season: string, week: number) =>
  `https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=regular`;

// os.tmpdir() rather than a project-relative folder: serverless hosts like
// Vercel have a read-only filesystem except /tmp (which os.tmpdir()
// resolves to there), and it's just as valid a cache location locally.
// /tmp is ephemeral — wiped between cold starts — so this is a
// best-effort speedup, not a durable cache; every read/write below treats
// a miss or failure as normal, not an error.
const CACHE_DIR = path.join(os.tmpdir(), "fantasy-team-grader-cache");
const PLAYERS_CACHE_FILE = path.join(CACHE_DIR, "sleeper-players.json");
const PLAYERS_TTL_MS = 24 * 60 * 60 * 1000; // 24h, per Sleeper's own guidance
const STATS_TTL_MS = 6 * 60 * 60 * 1000; // 6h — in-season totals shift during the week
const STATE_TTL_MS = 60 * 60 * 1000; // 1h — cheap call, but the week does change
const PROJECTIONS_TTL_MS = 3 * 60 * 60 * 1000; // 3h — projections update through the week

interface RawSleeperPlayer {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  injury_status?: string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  position?: string | null;
  team?: string | null;
  fantasy_positions?: string[] | null;
}

interface RawStatEntry {
  player_id: string;
  player?: { position?: string | null; team?: string | null } | null;
  stats?: Record<string, number | undefined> | null;
}

interface RawProjectionEntry {
  player_id: string;
  opponent?: string | null;
  stats?: Record<string, number | undefined> | null;
}

interface RawNFLState {
  week?: number;
  season?: string;
  season_type?: string;
}

interface CacheEnvelope<T> {
  fetchedAt: number;
  data: T;
}

async function readCache<T>(file: string, maxAgeMs: number): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - parsed.fetchedAt > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeCache<T>(file: string, data: T): Promise<void> {
  // Best-effort: a cache write failing (read-only FS, out of space, a
  // wiped /tmp mid-request) should never break the actual request.
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const envelope: CacheEnvelope<T> = { fetchedAt: Date.now(), data };
    await fs.writeFile(file, JSON.stringify(envelope), "utf-8");
  } catch {
    // ignore — next call just re-fetches from Sleeper
  }
}

// --- Player identity DB -----------------------------------------------

let playersMemoryCache: SleeperPlayerRecord[] | null = null;

export async function getAllPlayers(): Promise<SleeperPlayerRecord[]> {
  if (playersMemoryCache) return playersMemoryCache;

  const cached = await readCache<Record<string, RawSleeperPlayer>>(PLAYERS_CACHE_FILE, PLAYERS_TTL_MS);
  let raw = cached;
  if (!raw) {
    const res = await fetch(PLAYERS_URL);
    if (!res.ok) throw new Error(`Sleeper players API error ${res.status}`);
    raw = (await res.json()) as Record<string, RawSleeperPlayer>;
    await writeCache(PLAYERS_CACHE_FILE, raw);
  }

  const list: SleeperPlayerRecord[] = Object.values(raw)
    .filter((p): p is RawSleeperPlayer & { player_id: string } => typeof p.player_id === "string")
    .map((p) => ({
      playerId: p.player_id,
      fullName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.player_id,
      position: p.position || "UNKNOWN",
      team: p.team || null,
      fantasyPositions: p.fantasy_positions || (p.position ? [p.position] : []),
      injuryStatus: p.injury_status || null,
      injuryBodyPart: p.injury_body_part || null,
      injuryNotes: p.injury_notes || null,
    }));

  playersMemoryCache = list;
  return list;
}

// --- Season stats --------------------------------------------------------

const scoringField: Record<ScoringFormat, string> = {
  std: "pts_std",
  half_ppr: "pts_half_ppr",
  ppr: "pts_ppr",
};

interface PlayerSeasonStat {
  points: number;
  gamesPlayed: number;
}

async function fetchSeasonStatsRaw(season: string): Promise<RawStatEntry[]> {
  const cacheFile = path.join(CACHE_DIR, `sleeper-stats-${season}.json`);
  const cached = await readCache<RawStatEntry[]>(cacheFile, STATS_TTL_MS);
  if (cached) return cached;

  const res = await fetch(STATS_URL(season));
  if (!res.ok) throw new Error(`Sleeper stats API error ${res.status} for season ${season}`);
  const data = (await res.json()) as RawStatEntry[];
  await writeCache(cacheFile, data);
  return data;
}

function currentCandidateSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NFL season labels flip over around September; before that, last year's
  // season is the one with a full, meaningful stat line.
  return month >= 9 ? year : year - 1;
}

/**
 * Returns season stats keyed by Sleeper player id, using the most recent
 * season that actually has meaningful data (falls back a year if the
 * current season has barely started, e.g. very early September).
 */
export async function getBestAvailableSeasonStats(
  scoring: ScoringFormat
): Promise<{ season: string; statsByPlayerId: Map<string, PlayerSeasonStat> }> {
  const candidate = currentCandidateSeason();
  const field = scoringField[scoring];

  for (const year of [candidate, candidate - 1]) {
    const season = String(year);
    const raw = await fetchSeasonStatsRaw(season);
    const totalGamesPlayed = raw.reduce((sum, e) => sum + (e.stats?.gp ?? 0), 0);
    // A real, mostly-complete season easily clears this; an unstarted one won't.
    if (totalGamesPlayed > 500 || year === candidate - 1) {
      const map = new Map<string, PlayerSeasonStat>();
      for (const entry of raw) {
        const points = entry.stats?.[field];
        const gp = entry.stats?.gp;
        if (typeof points === "number") {
          map.set(entry.player_id, { points, gamesPlayed: typeof gp === "number" ? gp : 0 });
        }
      }
      return { season, statsByPlayerId: map };
    }
  }

  // Should be unreachable (the loop always resolves on its second iteration),
  // but keep TypeScript happy and fail loudly if Sleeper's shape ever changes.
  throw new Error("Could not find any usable season stats from Sleeper.");
}

// --- Current week + weekly matchups/projections ---------------------------

const STATE_CACHE_FILE = path.join(CACHE_DIR, "sleeper-state.json");

/** The NFL's own idea of "what week is it" — authoritative, not derived from the calendar. */
export async function getCurrentNFLWeek(): Promise<{ season: string; week: number }> {
  const cached = await readCache<RawNFLState>(STATE_CACHE_FILE, STATE_TTL_MS);
  let state = cached;
  if (!state) {
    const res = await fetch(STATE_URL);
    if (!res.ok) throw new Error(`Sleeper state API error ${res.status}`);
    state = (await res.json()) as RawNFLState;
    await writeCache(STATE_CACHE_FILE, state);
  }
  if (!state.season || typeof state.week !== "number") {
    throw new Error("Sleeper state API returned an unexpected shape.");
  }
  return { season: state.season, week: state.week };
}

/**
 * This week's opponent + projected points for every player with a projection
 * (Rotowire-sourced via Sleeper). Returns an empty map rather than throwing
 * if the projections endpoint has nothing yet for the current week (e.g.
 * very early in the week before they're published) — matchup info is a
 * nice-to-have, not something that should break grading.
 */
export async function getWeeklyMatchups(
  scoring: ScoringFormat
): Promise<{ season: string; week: number; matchupsByPlayerId: Map<string, WeeklyMatchup> }> {
  const { season, week } = await getCurrentNFLWeek();
  const field = scoringField[scoring];
  const map = new Map<string, WeeklyMatchup>();

  try {
    const cacheFile = path.join(CACHE_DIR, `sleeper-projections-${season}-${week}.json`);
    const cached = await readCache<RawProjectionEntry[]>(cacheFile, PROJECTIONS_TTL_MS);
    let raw = cached;
    if (!raw) {
      const res = await fetch(PROJECTIONS_URL(season, week));
      if (!res.ok) throw new Error(`Sleeper projections API error ${res.status}`);
      raw = (await res.json()) as RawProjectionEntry[];
      await writeCache(cacheFile, raw);
    }
    for (const entry of raw) {
      const projectedPoints = entry.stats?.[field];
      map.set(entry.player_id, {
        week,
        opponent: entry.opponent || null,
        projectedPoints: typeof projectedPoints === "number" ? projectedPoints : null,
      });
    }
  } catch {
    // Matchup/projection data is a bonus feature, not core to grading —
    // fall through and return whatever (possibly empty) map we have.
  }

  return { season, week, matchupsByPlayerId: map };
}

// --- Name matching ---------------------------------------------------------

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[.'']/g, "")
    .split(/\s+/)
    .filter((tok) => tok && !SUFFIXES.has(tok))
    .join(" ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / Math.max(na.length, nb.length));
}

// Team defenses are stored in Sleeper's player list with the team abbreviation
// as both the player_id and position "DEF". Screenshots often show a city or
// nickname instead of the abbreviation, so we keep a small lookup for those.
const TEAM_ALIASES: Record<string, string> = {
  cardinals: "ARI", arizona: "ARI",
  falcons: "ATL", atlanta: "ATL",
  ravens: "BAL", baltimore: "BAL",
  bills: "BUF", buffalo: "BUF",
  panthers: "CAR", carolina: "CAR",
  bears: "CHI", chicago: "CHI",
  bengals: "CIN", cincinnati: "CIN",
  browns: "CLE", cleveland: "CLE",
  cowboys: "DAL", dallas: "DAL",
  broncos: "DEN", denver: "DEN",
  lions: "DET", detroit: "DET",
  packers: "GB", "green bay": "GB",
  texans: "HOU", houston: "HOU",
  colts: "IND", indianapolis: "IND",
  jaguars: "JAX", jacksonville: "JAX",
  chiefs: "KC", "kansas city": "KC",
  raiders: "LV", "las vegas": "LV",
  chargers: "LAC",
  rams: "LAR",
  dolphins: "MIA", miami: "MIA",
  vikings: "MIN", minnesota: "MIN",
  patriots: "NE", "new england": "NE",
  saints: "NO", "new orleans": "NO",
  giants: "NYG",
  jets: "NYJ",
  eagles: "PHI", philadelphia: "PHI",
  steelers: "PIT", pittsburgh: "PIT",
  "49ers": "SF", niners: "SF", "san francisco": "SF",
  seahawks: "SEA", seattle: "SEA",
  buccaneers: "TB", bucs: "TB", "tampa bay": "TB",
  titans: "TEN", tennessee: "TEN",
  commanders: "WAS", washington: "WAS",
};

function resolveDefenseTeamCode(rawName: string, nflTeam: string | null): string | null {
  if (nflTeam && nflTeam.length <= 4) return nflTeam.toUpperCase();
  const key = rawName.toLowerCase().replace(/\bd\/?st\b|defense/g, "").trim();
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  for (const [alias, code] of Object.entries(TEAM_ALIASES)) {
    if (key.includes(alias)) return code;
  }
  return null;
}

export interface MatchResult {
  sleeperId: string | null;
  matchedName: string | null;
  matchScore: number;
}

/** Best-effort match of an extracted (rawName, position) pair to a Sleeper player. */
export function matchPlayer(
  rawName: string,
  position: string,
  nflTeam: string | null,
  allPlayers: SleeperPlayerRecord[]
): MatchResult {
  const pos = position.toUpperCase();

  if (pos === "DEF") {
    const code = resolveDefenseTeamCode(rawName, nflTeam);
    if (code) {
      const def = allPlayers.find((p) => p.position === "DEF" && p.playerId === code);
      if (def) return { sleeperId: def.playerId, matchedName: def.fullName, matchScore: 1 };
    }
    return { sleeperId: null, matchedName: null, matchScore: 0 };
  }

  const candidates = allPlayers.filter(
    (p) => p.fantasyPositions.includes(pos) || p.position === pos
  );
  const pool = candidates.length > 0 ? candidates : allPlayers;

  let best: MatchResult = { sleeperId: null, matchedName: null, matchScore: 0 };
  for (const candidate of pool) {
    let score = nameSimilarity(rawName, candidate.fullName);
    if (nflTeam && candidate.team && nflTeam.toUpperCase() === candidate.team.toUpperCase()) {
      score += 0.05; // small tiebreaker boost for a team match
    }
    if (score > best.matchScore) {
      best = { sleeperId: candidate.playerId, matchedName: candidate.fullName, matchScore: Math.min(score, 1) };
    }
  }

  // Below this, it's more likely a wrong guess than a real (if imperfect) read.
  const MIN_CONFIDENT_SCORE = 0.6;
  if (best.matchScore < MIN_CONFIDENT_SCORE) {
    return { sleeperId: null, matchedName: best.matchedName, matchScore: best.matchScore };
  }
  return best;
}
