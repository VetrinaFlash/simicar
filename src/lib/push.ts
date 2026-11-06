import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { b64urlToBytes, bytesToB64url } from "@/lib/security/crypto";

/*
 * Web Push con VAPID (RFC 8292), implementato con WebCrypto (gira su Workers).
 * Le push non contengono dati: il service worker, ricevuta la push, scarica
 * l'ultima notifica dal server con la sessione dell'admin. Così nessun dato
 * dei clienti passa dai server push di Google/Apple/Mozilla.
 */

let cachedKey: { pub: string; key: CryptoKey } | null = null;

async function signingKey(env: CloudflareEnv) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  if (cachedKey?.pub === env.VAPID_PUBLIC_KEY) return cachedKey.key;
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY non valida");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: env.VAPID_PRIVATE_KEY,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: false,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  cachedKey = { pub: env.VAPID_PUBLIC_KEY, key };
  return key;
}

async function vapidJwt(env: CloudflareEnv, audience: string, key: CryptoKey) {
  const enc = new TextEncoder();
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT }),
    ),
  );
  const input = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(input));
  return `${input}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Invia una push "sveglia" a tutti i dispositivi registrati. */
export async function pushToAllAdmins() {
  const env = await getEnv();
  const key = await signingKey(env);
  if (!key) return;
  const db = await getDb();
  const subs = await db.select().from(schema.pushSubscriptions);
  await Promise.all(
    subs.map(async (s) => {
      try {
        const url = new URL(s.endpoint);
        const jwt = await vapidJwt(env, url.origin, key);
        const res = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            TTL: "86400",
            Urgency: "high",
            Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            "Content-Length": "0",
          },
        });
        // Abbonamento scaduto o revocato: lo rimuoviamo
        if (res.status === 404 || res.status === 410) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
        }
      } catch (err) {
        console.error("[push]", err);
      }
    }),
  );
}

/** Solo endpoint dei servizi push dei browser principali (evita SSRF). */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    return (
      h === "fcm.googleapis.com" ||
      h === "updates.push.services.mozilla.com" ||
      h.endsWith(".push.services.mozilla.com") ||
      h === "web.push.apple.com" ||
      h.endsWith(".push.apple.com") ||
      h.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
