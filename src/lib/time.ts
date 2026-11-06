export const TZ = "Europe/Rome";
export const DAY_MS = 86_400_000;

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function romeParts(ms: number) {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute! };
}

function offsetMs(ms: number) {
  const p = romeParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - (ms - (ms % 60_000));
}

/** "2026-11-10" + "09:30" (ora di Roma) → epoch ms UTC. Gestisce l'ora legale. */
export function romeToUtc(date: string, time = "00:00"): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, mi!);
  const o1 = offsetMs(guess - offsetMs(guess));
  let t = guess - o1;
  const o2 = offsetMs(t);
  if (o2 !== o1) t = guess - o2;
  return t;
}

export function toRomeDate(ms: number): string {
  const p = romeParts(ms);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function toRomeTime(ms: number): string {
  const p = romeParts(ms);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function todayRome(): string {
  return toRomeDate(Date.now());
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return t.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / DAY_MS);
}

const dtFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const dLongFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const fmtDateTime = (ms: number) => dtFmt.format(ms);
export const fmtDate = (ms: number) => dFmt.format(ms);
export const fmtDateLong = (ms: number) => dLongFmt.format(ms);

export function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dFmt.format(romeToUtc(iso, "12:00"));
}

/** Durata leggibile: "3 giorni", "1 giorno e 4 ore", "5 ore". */
export function fmtDuration(startAt: number, endAt: number): string {
  const hours = Math.round((endAt - startAt) / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return `${hours} ${hours === 1 ? "ora" : "ore"}`;
  const d = `${days} ${days === 1 ? "giorno" : "giorni"}`;
  return rest ? `${d} e ${rest} ${rest === 1 ? "ora" : "ore"}` : d;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ${d === 1 ? "giorno" : "giorni"} fa`;
  return fmtDate(ms);
}
