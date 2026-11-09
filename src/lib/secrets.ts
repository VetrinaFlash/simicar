import "server-only";
import { getEnv } from "@/lib/env";
import { bytesToB64url, randomToken } from "@/lib/security/crypto";

/*
 * Segreti generati automaticamente e conservati nel database (privato), così non
 * vanno configurati a mano su Cloudflare né scritti nel codice (il repository è pubblico).
 * Sono salvati nella tabella settings con chiavi "__secret_*", che getSettings() non espone mai.
 */

const cache = new Map<string, string>();

async function getOrCreate(name: string, generate: () => Promise<string>): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;
  const env = await getEnv();
  const key = `__secret_${name}`;
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) {
    // INSERT OR IGNORE: se due richieste arrivano insieme, vince la prima e l'altra rilegge lo stesso valore
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(key, await generate()).run();
    row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  }
  if (!row) throw new Error(`Impossibile creare il segreto ${name}`);
  cache.set(name, row.value);
  return row.value;
}

export type Vapid = { publicKey: string; privateKey: string };

/** Coppia di chiavi VAPID per le notifiche push (P-256). */
export async function getVapid(): Promise<Vapid> {
  const raw = await getOrCreate("vapid", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    return JSON.stringify({ publicKey: bytesToB64url(pub), privateKey: jwk.d });
  });
  return JSON.parse(raw) as Vapid;
}

/** Segreto che autorizza il cron giornaliero. */
export function getCronSecret() {
  return getOrCreate("cron", async () => randomToken(32));
}

/** Salt per l'hash degli IP (gli IP non vengono mai salvati in chiaro). */
export function getIpSalt() {
  return getOrCreate("ip_salt", async () => randomToken(32));
}
