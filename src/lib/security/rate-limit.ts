import "server-only";
import { getEnv } from "@/lib/env";

/**
 * Rate limit a finestra fissa su D1, con un'unica istruzione atomica (upsert).
 * Restituisce true se la richiesta è consentita.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const env = await getEnv();
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = ?2 THEN rate_limits.count + 1 ELSE 1 END,
       window_start = ?2
     RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}
