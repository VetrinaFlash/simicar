// Tipi delle binding Cloudflare
import type { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types/experimental/index.ts";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    MEDIA: R2Bucket;
    ASSETS: Fetcher;
    APP_ENV: "production" | "development";
    PUBLIC_SITE_URL: string;
    RESEND_API_KEY?: string;
    RESEND_FROM: string;
    TURNSTILE_SECRET_KEY?: string;
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT: string;
    IP_HASH_SALT?: string;
    CRON_SECRET?: string;
    ADMIN_SETUP_TOKEN?: string;
  }
}
export {};
