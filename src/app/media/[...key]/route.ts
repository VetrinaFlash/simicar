import type { R2Conditional } from "@cloudflare/workers-types/experimental/index.ts";
import { getEnv } from "@/lib/env";

/** Serve SOLO le foto pubbliche dei veicoli. Nessun altro prefisso è esposto. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^vehicles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return new Response("Not found", { status: 404 });

  const env = await getEnv();
  const obj = await env.MEDIA.get(path, { onlyIf: req.headers as unknown as R2Conditional });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers as unknown as Parameters<typeof obj.writeHttpMetadata>[0]);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body as unknown as ReadableStream, { headers });
}
