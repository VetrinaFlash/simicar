import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { getPublicVehicles } from "@/lib/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [env, vehicles] = await Promise.all([getEnv(), getPublicVehicles()]);
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...vehicles.map((v) => ({ url: `${base}/flotta/${v.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
