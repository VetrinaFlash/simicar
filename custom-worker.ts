// Entry point del Worker: avvolge l'handler generato da OpenNext
// e aggiunge il cron giornaliero (promemoria e scadenze flotta).
import type { ExecutionContext, ExportedHandler, ScheduledController } from "@cloudflare/workers-types/experimental/index.ts";
// @ts-expect-error: file generato in fase di build
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const url = new URL("/api/cron/daily", env.PUBLIC_SITE_URL);
    ctx.waitUntil(
      handler.fetch(
        new Request(url, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET ?? "" } }),
        env,
        ctx,
      ),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
