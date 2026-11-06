export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";

export async function GET() {
  const s = await getSettings();
  return Response.json(
    {
      name: `${s.businessName} · Gestione`,
      short_name: "Gestione",
      start_url: "/admin",
      scope: "/admin/",
      display: "standalone",
      background_color: "#e9ebee",
      theme_color: "#1a3fa0",
      lang: "it",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
