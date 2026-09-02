# Fantasy Team Grader

Upload screenshots of your fantasy football roster (from any app — Sleeper,
ESPN, Yahoo, whatever) and get a stats-based grade on your team: an overall
grade plus a breakdown per position, backed by real season fantasy-points
data.

This is an MVP for personal, local use — no accounts, no database, nothing
persisted between sessions. Start/sit and add/drop recommendations (matchup-
and momentum-aware) are a planned Phase 2, built on top of this same
extraction + grading pipeline.

## How it works

1. You upload one or more roster screenshots and pick your league's scoring
   format.
2. [Groq's free API](https://console.groq.com) runs a vision model
   (`qwen/qwen3.6-27b`) that reads each screenshot and extracts player
   name / position / team / starter-or-bench.
3. You review and fix the extracted roster (vision reads aren't perfect —
   this step catches misreads before they affect your grade).
4. Each player is matched to [Sleeper's](https://sleeper.com) public player
   database and joined with real season fantasy-points data.
5. Each player is graded by percentile against every other real player at
   their position; positions roll up into an overall team grade.

## Setup

Requires Node 18+.

```bash
npm install
cp .env.local.example .env.local
```

Then get a **free** Groq API key (no credit card) at
[console.groq.com/keys](https://console.groq.com/keys) and paste it into
`.env.local`:

```
GROQ_API_KEY=gsk_...
```

Run it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying (optional — for a public, shareable link)

This is a standard Next.js app, so [Vercel](https://vercel.com)'s free tier
is the easiest fit (built by the Next.js team, zero-config):

1. Push this repo to GitHub.
2. Import it on Vercel (sign in with GitHub, "New Project" → pick the repo).
3. Add `GROQ_API_KEY` as an environment variable in the Vercel project
   settings (same value as your local `.env.local`) — it deploys automatically
   after that.

**Worth knowing before making it public:** every visitor's screenshot
extraction uses *your* Groq API key, so they all share your account's free-
tier rate limit (30 requests/min, 1,000/day as of writing) — fine for
sharing with friends or a portfolio link, but something to watch if it gets
wide traffic. There's no login system, so anyone with the link can use it;
nothing is stored server-side between requests.

## Notes / known limitations (MVP)

- **Cost:** effectively free. Groq's free tier (no credit card) covers this
  app's usage many times over for personal use.
- **Sleeper's player list** (~15MB) and season stats are cached to the OS
  temp directory (via `os.tmpdir()`) since Sleeper asks that the full player
  list not be fetched more than once a day. This is a best-effort speedup,
  not a durable cache — serverless hosts wipe it between cold starts, and a
  cache write failing never breaks a request.
- **Season used for grading:** the current NFL season if it has meaningful
  data yet, otherwise the most recently completed one (see
  `getBestAvailableSeasonStats` in `lib/sleeper.ts`).
- **Superflex leagues** aren't specially weighted yet — a 2nd/3rd startable
  QB is worth much more there than a plain position-percentile captures.
- **Name matching** is fuzzy (Levenshtein-based) and requires a decent
  confidence score to auto-match; anything under the threshold is flagged
  as unmatched rather than silently mis-graded — fix the name in the review
  step and re-grade.

## Project structure

```
app/
  page.tsx                 wizard: upload -> review -> report
  api/extract-roster/      POST: screenshots -> extracted roster (Groq)
  api/grade-team/          POST: roster + settings -> TeamReport
components/
  UploadStep.tsx           screenshot upload + league settings
  ReviewStep.tsx           editable roster table
  ReportStep.tsx           grade + per-position breakdown
lib/
  groq.ts                  vision extraction (Groq API)
  sleeper.ts                player identity DB, season stats, name matching
  grading.ts                percentile scoring, letter grades
  types.ts                  shared types
```
