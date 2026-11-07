import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { getPublicVehicles, getSaleVehicles } from "@/lib/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [env, vehicles, forSale] = await Promise.all([getEnv(), getPublicVehicles(), getSaleVehicles()]);
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...vehicles.map((v) => ({ url: `${base}/flotta/${v.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...forSale.map((v) => ({ url: `${base}/vendita/${v.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
