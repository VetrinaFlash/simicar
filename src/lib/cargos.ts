import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getSettings, type Settings } from "@/lib/settings";
import { CARGOS_VEHICLE_TYPE } from "@/lib/cargos-tables";
import { TZ } from "@/lib/time";

/*
 * Invio automatico dei contratti di noleggio al sistema Ca.R.G.O.S. della Polizia di Stato
 * (art. 17 D.L. 113/2018). Specifiche: "Documento di Descrizione Architetturale Ca.R.G.O.S."
 * - Token: GET api/Token con Basic auth (username/password dell'agenzia)
 * - Il token va cifrato AES-256-CBC (chiave = primi 32 caratteri della API key, IV = caratteri 33-48), Base64
 * - Check / Send: POST con array di "tracciati record" a larghezza fissa (1505 caratteri)
 * Se le credenziali non sono configurate, tutto il resto del gestionale funziona normalmente.
 */

const BASE = "https://cargos.poliziadistato.it/CARGOS_API/api";
const RECORD_LENGTH = 1505;

type Field = { start: number; end: number; right?: boolean };
const F = {
  CONTRATTO_ID: { start: 1, end: 50 },
  CONTRATTO_DATA: { start: 51, end: 66 },
  CONTRATTO_TIPOP: { start: 67, end: 67 },
  CHECKOUT_DATA: { start: 68, end: 83 },
  CHECKOUT_LUOGO: { start: 84, end: 92, right: true },
  CHECKOUT_INDIRIZZO: { start: 93, end: 242 },
  CHECKIN_DATA: { start: 243, end: 258 },
  CHECKIN_LUOGO: { start: 259, end: 267, right: true },
  CHECKIN_INDIRIZZO: { start: 268, end: 417 },
  OPERATORE_ID: { start: 418, end: 467 },
  AGENZIA_ID: { start: 468, end: 497 },
  AGENZIA_NOME: { start: 498, end: 567 },
  AGENZIA_LUOGO: { start: 568, end: 576, right: true },
  AGENZIA_INDIRIZZO: { start: 577, end: 726 },
  AGENZIA_TEL: { start: 727, end: 746 },
  VEICOLO_TIPO: { start: 747, end: 747 },
  VEICOLO_MARCA: { start: 748, end: 797 },
  VEICOLO_MODELLO: { start: 798, end: 897 },
  VEICOLO_TARGA: { start: 898, end: 912 },
  VEICOLO_COLORE: { start: 913, end: 962 },
  VEICOLO_GPS: { start: 963, end: 963 },
  VEICOLO_BLOCCOM: { start: 964, end: 964 },
  C1_COGNOME: { start: 965, end: 1014 },
  C1_NOME: { start: 1015, end: 1044 },
  C1_NASCITA_DATA: { start: 1045, end: 1054 },
  C1_NASCITA_LUOGO: { start: 1055, end: 1063, right: true },
  C1_CITTADINANZA: { start: 1064, end: 1072, right: true },
  C1_RESIDENZA_LUOGO: { start: 1073, end: 1081, right: true },
  C1_RESIDENZA_INDIRIZZO: { start: 1082, end: 1231 },
  C1_DOC_TIPO: { start: 1232, end: 1236 },
  C1_DOC_NUMERO: { start: 1237, end: 1256 },
  C1_DOC_LUOGO: { start: 1257, end: 1265, right: true },
  C1_PATENTE_NUMERO: { start: 1266, end: 1285 },
  C1_PATENTE_LUOGO: { start: 1286, end: 1294, right: true },
  C1_RECAPITO: { start: 1295, end: 1314 },
} satisfies Record<string, Field>;

/** Testo pulito per il tracciato: niente a capo né caratteri di controllo. */
function txt(v: string | number | null | undefined): string {
  return String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pad(f: Field, v: string | number | null | undefined) {
  const len = f.end - f.start + 1;
  const s = txt(v).slice(0, len);
  return f.right ? s.padStart(len, " ") : s.padEnd(len, " ");
}

const romeDT = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** gg/mm/aaaa hh:mm (ora italiana) */
export function cargosDateTime(ms: number) {
  const p: Record<string, string> = {};
  for (const x of romeDT.formatToParts(ms)) p[x.type] = x.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
/** yyyy-mm-dd → gg/mm/aaaa */
const isoToIt = (iso: string) => iso.split("-").reverse().join("/");

type Booking = typeof schema.bookings.$inferSelect;
type Vehicle = typeof schema.vehicles.$inferSelect;
type Customer = typeof schema.customers.$inferSelect;

export type CargosBuild = { record: string | null; missing: string[] };

/** Costruisce il tracciato record e restituisce l'elenco (in italiano) dei dati mancanti. */
export function buildCargosRecord(d: { b: Booking; v: Vehicle; c: Customer | null; s: Settings; operator: string }): CargosBuild {
  const { b, v, c, s } = d;
  const missing: string[] = [];
  const need = (ok: unknown, label: string) => {
    if (ok === null || ok === undefined || ok === "" || ok === 0) missing.push(label);
  };
  const agencyCode = Number(s.cargosAgencyPlaceCode) || null;
  const address = txt(s.address);

  need(s.cargosAgencyId, "Codice agenzia CaRGOS (Impostazioni)");
  need(agencyCode, "Comune della sede (Impostazioni)");
  if (address.length <= 3) missing.push("Indirizzo della sede (Impostazioni)");
  if (txt(s.phone).length <= 3) missing.push("Telefono dell'attività (Impostazioni)");
  need(b.paymentType || s.cargosPaymentType, "Metodo di pagamento");
  if (txt(v.plate).length <= 3) missing.push("Targa del veicolo");
  if (!c) missing.push("Cliente");
  else {
    need(c.lastName, "Cognome del cliente");
    need(c.firstName, "Nome del cliente");
    need(c.birthDate, "Data di nascita del cliente");
    need(c.birthPlaceCode, "Luogo di nascita del cliente");
    need(c.citizenshipCode, "Cittadinanza del cliente");
    need(c.docTypeCode, "Tipo di documento del cliente");
    if (txt(c.docNumber).length <= 4) missing.push("Numero del documento del cliente");
    need(c.docIssuedCode, "Luogo di rilascio del documento");
    if (txt(c.licenseNumber).length <= 4) missing.push("Numero di patente del cliente");
    need(c.licenseIssuedCode, "Luogo di rilascio della patente");
  }
  if (missing.length) return { record: null, missing };

  // Residenza: va inviata solo se ci sono sia il comune sia l'indirizzo
  const hasResidence = !!(c!.residenceCode && txt(c!.address).length > 3);

  const parts: [Field, string | number | null | undefined][] = [
    [F.CONTRATTO_ID, b.code],
    [F.CONTRATTO_DATA, cargosDateTime(Math.min(b.decidedAt ?? b.createdAt, b.startAt))],
    [F.CONTRATTO_TIPOP, b.paymentType || s.cargosPaymentType],
    [F.CHECKOUT_DATA, cargosDateTime(b.startAt)],
    [F.CHECKOUT_LUOGO, agencyCode],
    [F.CHECKOUT_INDIRIZZO, address],
    [F.CHECKIN_DATA, cargosDateTime(b.endAt)],
    [F.CHECKIN_LUOGO, agencyCode],
    [F.CHECKIN_INDIRIZZO, address],
    [F.OPERATORE_ID, d.operator],
    [F.AGENZIA_ID, s.cargosAgencyId],
    [F.AGENZIA_NOME, s.businessName],
    [F.AGENZIA_LUOGO, agencyCode],
    [F.AGENZIA_INDIRIZZO, address],
    [F.AGENZIA_TEL, s.phone],
    [F.VEICOLO_TIPO, CARGOS_VEHICLE_TYPE[v.type]],
    [F.VEICOLO_MARCA, v.brand],
    [F.VEICOLO_MODELLO, [v.model, v.version].filter(Boolean).join(" ")],
    [F.VEICOLO_TARGA, v.plate],
    [F.VEICOLO_COLORE, v.color],
    [F.VEICOLO_GPS, ""],
    [F.VEICOLO_BLOCCOM, ""],
    [F.C1_COGNOME, c!.lastName],
    [F.C1_NOME, c!.firstName],
    [F.C1_NASCITA_DATA, isoToIt(c!.birthDate!)],
    [F.C1_NASCITA_LUOGO, c!.birthPlaceCode],
    [F.C1_CITTADINANZA, c!.citizenshipCode],
    [F.C1_RESIDENZA_LUOGO, hasResidence ? c!.residenceCode : ""],
    [F.C1_RESIDENZA_INDIRIZZO, hasResidence ? c!.address : ""],
    [F.C1_DOC_TIPO, c!.docTypeCode],
    [F.C1_DOC_NUMERO, c!.docNumber],
    [F.C1_DOC_LUOGO, c!.docIssuedCode],
    [F.C1_PATENTE_NUMERO, c!.licenseNumber],
    [F.C1_PATENTE_LUOGO, c!.licenseIssuedCode],
    [F.C1_RECAPITO, c!.phone ?? c!.email],
  ];
  // Secondo conducente: non gestito, segmento vuoto (1315-1505)
  const record = parts.map(([f, val]) => pad(f, val)).join("") + " ".repeat(RECORD_LENGTH - 1314);
  if (record.length !== RECORD_LENGTH) throw new Error(`Tracciato CaRGOS di lunghezza errata: ${record.length}`);
  return { record, missing: [] };
}

/* ───────────── Client API ───────────── */

export async function cargosConfigured() {
  const env = await getEnv();
  return !!(env.CARGOS_USERNAME && env.CARGOS_PASSWORD && env.CARGOS_API_KEY && env.CARGOS_API_KEY.length >= 48);
}

let tokenCache: { token: string; exp: number; user: string } | null = null;

async function bearer(env: CloudflareEnv): Promise<string> {
  const user = env.CARGOS_USERNAME!;
  if (!tokenCache || tokenCache.user !== user || tokenCache.exp < Date.now() + 60_000) {
    const res = await fetch(`${BASE}/Token`, {
      headers: { Authorization: `Basic ${btoa(`${user}:${env.CARGOS_PASSWORD}`)}`, Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      token?: string;
      expires_date?: string;
      errore?: unknown;
      error_description?: string;
    };
    const token = data.access_token ?? data.token;
    if (!res.ok || !token) {
      throw new Error(`Accesso a CaRGOS non riuscito: ${data.error_description ?? JSON.stringify(data.errore ?? res.status)}`);
    }
    const exp = data.expires_date ? Date.parse(data.expires_date) : NaN;
    tokenCache = { token, user, exp: Number.isFinite(exp) ? exp : Date.now() + 15 * 60_000 };
  }
  // Cifratura AES-256-CBC (PKCS7) del token con la API key
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(env.CARGOS_API_KEY!.slice(0, 32)), { name: "AES-CBC" }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-CBC", iv: enc.encode(env.CARGOS_API_KEY!.slice(32, 48)) }, key, enc.encode(tokenCache.token));
  let bin = "";
  for (const x of new Uint8Array(ct)) bin += String.fromCharCode(x);
  return btoa(bin);
}

type CargosResult = { esito?: boolean; transactionid?: string; errore?: { error_description?: string; errore?: string; error_code?: number } | null };

async function call(path: "Check" | "Send", records: string[]): Promise<CargosResult[]> {
  const env = await getEnv();
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await bearer(env)}`,
      Organization: env.CARGOS_USERNAME!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(records),
  });
  if (res.status === 401) tokenCache = null;
  const data = (await res.json().catch(() => null)) as CargosResult[] | CargosResult | null;
  if (!res.ok || !data) throw new Error(`CaRGOS ha risposto con errore ${res.status}`);
  return Array.isArray(data) ? data : [data];
}

const errText = (r: CargosResult | undefined) =>
  r?.errore?.error_description || r?.errore?.errore || (r?.errore ? JSON.stringify(r.errore) : "Risposta non valida da CaRGOS");

export type SendOutcome = { ok: true; transactionId: string | null } | { ok: false; error: string; missing?: string[] };

/** Valida e invia a CaRGOS una prenotazione. Salva l'esito sulla prenotazione. */
export async function sendBookingToCargos(bookingId: string, operator: string): Promise<SendOutcome> {
  if (!(await cargosConfigured())) return { ok: false, error: "Invio automatico non configurato: mancano le credenziali CaRGOS." };
  const db = await getDb();
  const row = await db
    .select({ b: schema.bookings, v: schema.vehicles, c: schema.customers })
    .from(schema.bookings)
    .innerJoin(schema.vehicles, eq(schema.vehicles.id, schema.bookings.vehicleId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.bookings.customerId))
    .where(eq(schema.bookings.id, bookingId))
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.b.kind !== "rental") return { ok: false, error: "Prenotazione non trovata." };
  if (row.b.cargosTransactionId) return { ok: true, transactionId: row.b.cargosTransactionId };

  const built = buildCargosRecord({ ...row, s: await getSettings(), operator });
  const save = (v: Partial<typeof schema.bookings.$inferInsert>) =>
    db.update(schema.bookings).set({ cargosAttemptAt: Date.now(), ...v }).where(eq(schema.bookings.id, bookingId));
  if (!built.record) {
    const error = `Dati mancanti: ${built.missing.join(", ")}`;
    await save({ cargosError: error });
    return { ok: false, error, missing: built.missing };
  }
  try {
    const [check] = await call("Check", [built.record]);
    if (!check?.esito) {
      const error = `Controllo CaRGOS non superato: ${errText(check)}`;
      await save({ cargosError: error });
      return { ok: false, error };
    }
    const [sent] = await call("Send", [built.record]);
    if (!sent?.esito) {
      const error = `Invio rifiutato da CaRGOS: ${errText(sent)}`;
      await save({ cargosError: error });
      return { ok: false, error };
    }
    await save({ cargosSentAt: Date.now(), cargosTransactionId: sent.transactionid ?? null, cargosError: null });
    return { ok: true, transactionId: sent.transactionid ?? null };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Errore di comunicazione con CaRGOS";
    await save({ cargosError: error });
    return { ok: false, error };
  }
}
