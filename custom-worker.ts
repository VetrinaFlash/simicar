// Entry point del Worker: avvolge l'handler generato da OpenNext
// e aggiunge il cron giornaliero (promemoria e scadenze flotta).
import type { ExecutionContext, ExportedHandler, ScheduledController } from "@cloudflare/workers-types/experimental/index.ts";
// @ts-expect-error: file generato in fase di build
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    // Il segreto del cron è generato e conservato nel database (vedi src/lib/secrets.ts)
    const key = "__secret_cron";
    const read = () => env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
    let row = await read();
    if (!row) {
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(key, `${crypto.randomUUID()}${crypto.randomUUID()}`).run();
      row = await read();
    }
    const url = new URL("/api/cron/daily", env.PUBLIC_SITE_URL);
    ctx.waitUntil(
      handler.fetch(new Request(url, { method: "POST", headers: { "x-cron-secret": row?.value ?? "" } }), env, ctx),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
