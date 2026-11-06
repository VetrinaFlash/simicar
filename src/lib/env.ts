import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function cf() {
  return getCloudflareContext({ async: true });
}

export async function getEnv(): Promise<CloudflareEnv> {
  return (await cf()).env;
}

/** Esegue un lavoro dopo la risposta (email, push) senza rallentare l'utente. */
export async function runInBackground(promise: Promise<unknown>) {
  const { ctx } = await cf();
  const guarded = promise.catch((err) => console.error("[background]", err));
  ctx.waitUntil(guarded);
}

export function isProduction(env: CloudflareEnv) {
  return env.APP_ENV === "production";
}
