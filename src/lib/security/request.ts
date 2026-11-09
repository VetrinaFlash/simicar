import "server-only";
import { headers } from "next/headers";
import { getIpSalt } from "@/lib/secrets";
import { sha256Hex } from "./crypto";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}

/** L'IP non viene mai salvato in chiaro (GDPR): solo un hash con salt. */
export async function ipHash(): Promise<string> {
  return (await sha256Hex(`${await getIpSalt()}:${await clientIp()}`)).slice(0, 32);
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

/** Protezione CSRF per le route API: l'Origin deve coincidere con l'host. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
