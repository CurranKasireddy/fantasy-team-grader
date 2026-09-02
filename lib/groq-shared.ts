// Small helpers shared by every Groq API caller (vision extraction, lineup
// chat, ...): rate-limit backoff and its header parsing.

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parses either a plain-seconds string ("22.3") or a Go-style duration
 * string ("2m59.56s", "7.66s") as used by Groq's rate-limit headers. */
export function parseDelaySeconds(value: string | null): number | null {
  if (!value) return null;
  const plain = Number(value);
  if (!Number.isNaN(plain)) return plain;
  const match = value.match(/^(?:(\d+)m)?(?:([\d.]+)s)?$/);
  if (match && (match[1] || match[2])) {
    return (match[1] ? Number(match[1]) * 60 : 0) + (match[2] ? Number(match[2]) : 0);
  }
  return null;
}
