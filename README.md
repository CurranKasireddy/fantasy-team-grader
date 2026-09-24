# Fantasy Team Grader

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CurranKasireddy/fantasy-team-grader&env=GROQ_API_KEY&envDescription=Free%20API%20key%20from%20console.groq.com%2Fkeys)

Upload screenshots of your fantasy football roster (from any app — Sleeper,
ESPN, Yahoo, whatever) and get a stats-based grade on your team, a
per-player breakdown with injury status / this week's matchup / projected
points, and a chatbot to ask start/sit questions grounded in that same real
data.

This is an MVP for personal/friends use — no accounts, no database, nothing
persisted between sessions. Add/drop recommendations from a free-agent
screenshot (reusing this same extraction + grading pipeline) are a planned
next step.

## How it works

1. You upload one or more roster screenshots and pick your league's scoring
   format.
2. [Groq's free API](https://console.groq.com) runs a vision model
   (`qwen/qwen3.8-27b`) that reads each screenshot and extracts player
   name / position / team / starter-or-bench.
3. You review and fix the extracted roster (vision reads aren't perfect —
   this step catches misreads before they affect your grade).
4. Each player is matched to [Sleeper's](https://sleeper.com) public player
   database and joined with real season fantasy-points data, this week's
   matchup/projection, and injury status.
5. Each player is graded by percentile against every other real player at
   their position; positions roll up into an overall team grade. Click any
   player for their full detail (health, next matchup, projection), or ask
   the built-in chatbot a start/sit question about your actual roster.

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

Click the "Deploy with Vercel" button at the top of this README — it clones
this repo into a new Vercel project and prompts for the one environment
variable it needs (`GROQ_API_KEY`, same free key from
[console.groq.com/keys](https://console.groq.com/keys)). Sign in with GitHub
if you haven't already; no separate account/password needed.

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
  layout.tsx                theme (light/dark) anti-flash script + header
  api/extract-roster/      POST: screenshots -> extracted roster (Groq)
  api/grade-team/          POST: roster + settings -> TeamReport (+ matchup/injury)
  api/lineup-chat/         POST: chat history + roster -> assistant reply (Groq)
components/
  UploadStep.tsx           screenshot upload + league settings
  ReviewStep.tsx           editable roster table
  ReportStep.tsx           grade + per-position breakdown
  PlayerDetailModal.tsx    click a player: health, next matchup, projection
  LineupChat.tsx           "ask about your lineup" start/sit chatbot
  Header.tsx / ThemeToggle.tsx / StepIndicator.tsx
lib/
  groq.ts                  vision extraction (Groq API)
  lineup-chat.ts           start/sit chat (Groq, text-only)
  groq-shared.ts           rate-limit backoff shared by both Groq callers
  sleeper.ts                player identity DB, season/weekly stats, name matching
  grading.ts                percentile scoring, letter grades
  types.ts                  shared types
```
