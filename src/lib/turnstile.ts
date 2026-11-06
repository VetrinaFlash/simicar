import "server-only";
import { getEnv, isProduction } from "@/lib/env";
import { clientIp } from "@/lib/security/request";

/**
 * Verifica anti-bot Cloudflare Turnstile.
 * - Turnstile non configurato (nessuna chiave): si passa, restano honeypot e limiti di frequenza.
 * - Chiave pubblica presente ma segreta mancante in produzione: blocca (configurazione incompleta).
 */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  const env = await getEnv();
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && isProduction(env)) return false;
    return true;
  }
  if (!token || token.length > 2048) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  body.append("remoteip", await clientIp());
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
