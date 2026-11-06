"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Script from "next/script";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { requestBookingAction, type RequestState } from "@/app/(site)/actions";
import { cx } from "@/components/ui";
import { addDays, fmtDuration, fmtIsoDate, romeToUtc } from "@/lib/time";

type Range = { startAt: number; endAt: number };

const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const WD = ["L", "M", "M", "G", "V", "S", "D"];

function timeSlots(from: string, to: string) {
  const out: string[] = [];
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  for (let m = fh! * 60 + fm!; m <= th! * 60 + tm!; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // settimana da lunedì
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

const inputCls =
  "block h-13 w-full rounded-xl bg-paper px-4 text-[16px] ring-1 ring-line placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-eu";

export function BookingWidget({
  vehicleId,
  vehicleName,
  busy,
  today,
  openFrom,
  openTo,
  minNoticeHours,
  initialStart,
  initialEnd,
  turnstileSiteKey,
}: {
  vehicleId: string;
  vehicleName: string;
  busy: Range[];
  today: string;
  openFrom: string;
  openTo: string;
  minNoticeHours: number;
  initialStart: string;
  initialEnd: string;
  turnstileSiteKey?: string;
}) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestBookingAction, {});
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [hover, setHover] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(openFrom <= "09:00" && openTo >= "09:00" ? "09:00" : openFrom);
  const [endTime, setEndTime] = useState(openFrom <= "09:00" && openTo >= "09:00" ? "09:00" : openFrom);
  const firstMonth = (initialStart || today).slice(0, 7).split("-").map(Number);
  const [view, setView] = useState({ y: firstMonth[0]!, m: firstMonth[1]! - 1 });
  const turnstileEl = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");
  const widgetId = useRef<string | null>(null);

  const slots = useMemo(() => timeSlots(openFrom, openTo), [openFrom, openTo]);
  const earliest = Date.now() + minNoticeHours * 3_600_000;

  const dayState = useMemo(() => {
    const cache = new Map<string, "busy" | "partial" | "free">();
    return (d: string) => {
      const hit = cache.get(d);
      if (hit) return hit;
      const a = romeToUtc(d, openFrom);
      const b = romeToUtc(d, openTo);
      const overl = busy.filter((r) => r.startAt < b && r.endAt > a).sort((x, y) => x.startAt - y.startAt);
      let s: "busy" | "partial" | "free" = "free";
      if (overl.length) {
        let cursor = a;
        for (const r of overl) {
          if (r.startAt > cursor) break;
          cursor = Math.max(cursor, r.endAt);
        }
        s = cursor >= b ? "busy" : "partial";
      }
      cache.set(d, s);
      return s;
    };
  }, [busy, openFrom, openTo]);

  const tooEarly = (d: string) => romeToUtc(d, openTo) < earliest;

  function pick(d: string) {
    if (tooEarly(d) || dayState(d) === "busy") return;
    if (!start || (start && end) || d < start) {
      setStart(d);
      setEnd("");
      return;
    }
    // Il periodo non può attraversare un giorno completamente occupato
    for (let x = start; x <= d; x = addDays(x, 1)) {
      if (dayState(x) === "busy") {
        setStart(d);
        setEnd("");
        return;
      }
    }
    setEnd(d);
  }

  const startAt = start ? romeToUtc(start, startTime) : 0;
  const endAt = end ? romeToUtc(end, endTime) : 0;
  const ready = !!(start && end && endAt > startAt);
  const conflict = ready && busy.some((r) => r.startAt < endAt && r.endAt > startAt);
  const tooSoon = !!start && startAt < earliest;

  useEffect(() => {
    if (!turnstileSiteKey || !ready || widgetId.current) return;
    const tryRender = () => {
      if (window.turnstile && turnstileEl.current && !widgetId.current) {
        widgetId.current = window.turnstile.render(turnstileEl.current, {
          sitekey: turnstileSiteKey,
          language: "it",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(""),
        });
      }
    };
    tryRender();
    const i = setInterval(tryRender, 300);
    return () => clearInterval(i);
  }, [turnstileSiteKey, ready]);

  useEffect(() => {
    if (state.error && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setToken("");
    }
  }, [state]);

  const months = [view, view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 }];
  const canPrev = `${view.y}-${String(view.m + 1).padStart(2, "0")}` > today.slice(0, 7);
  const fe = state.fieldErrors ?? {};

  if (state.ok)
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="road-sign p-8 md:p-10" role="status">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
          className="grid size-16 place-items-center rounded-full bg-red text-white"
        >
          <Check className="size-9" strokeWidth={3} />
        </motion.div>
        <h3 className="font-narrow mt-6 text-[40px] font-black uppercase leading-none">Richiesta inviata</h3>
        <p className="mt-3 max-w-md text-[17px] leading-relaxed text-white/85">
          Ti abbiamo scritto a <strong className="text-white">{state.email}</strong> con il riepilogo. Appena verifichiamo la disponibilità ti arriva la conferma.
        </p>
        <p className="mt-6 text-[15px] text-white/70">
          Codice richiesta <span className="ml-1 rounded-md bg-white px-2 py-1 font-narrow text-[17px] font-bold tracking-wider text-ink">{state.code}</span>
        </p>
      </motion.div>
    );

  return (
    <form action={action} className="space-y-8">
      {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" />}
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="startDate" value={start} />
      <input type="hidden" name="endDate" value={end} />
      <input type="hidden" name="turnstileToken" value={token} />
      {/* Campo trappola per i bot: invisibile alle persone */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Sito web <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* 1. Date */}
      <fieldset>
        <legend className="text-[19px] font-extrabold tracking-tight">Quando ti serve?</legend>
        <p className="mt-1 text-[15px] text-ink-2">
          {!start ? "Tocca il giorno del ritiro." : !end ? "Ora tocca il giorno della riconsegna." : `Dal ${fmtIsoDate(start)} al ${fmtIsoDate(end)}.`}
        </p>
        <div className="mt-5 rounded-[20px] bg-paper p-4 ring-1 ring-line md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
              className="grid size-10 place-items-center rounded-full hover:bg-concrete disabled:opacity-30"
              aria-label="Mese precedente"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
              className="grid size-10 place-items-center rounded-full hover:bg-concrete"
              aria-label="Mese successivo"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {months.map((mo, mi) => (
              <div key={`${mo.y}-${mo.m}`} className={cx(mi === 1 && "hidden md:block")}>
                <p className="mb-3 text-center text-[15px] font-bold">
                  {MONTHS[mo.m]} {mo.y}
                </p>
                <div className="grid grid-cols-7 text-center text-xs font-semibold text-ink-3">
                  {WD.map((w, i) => (
                    <span key={i} className="pb-2">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
                  {monthGrid(mo.y, mo.m).map((d, i) => {
                    if (!d) return <span key={i} />;
                    const st = dayState(d);
                    const disabled = tooEarly(d) || st === "busy";
                    const rangeEnd = end || (start && hover && hover >= start ? hover : "");
                    const inRange = start && rangeEnd && d > start && d < rangeEnd;
                    const edge = d === start || d === end;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(d)}
                        onMouseEnter={() => setHover(d)}
                        aria-pressed={edge}
                        aria-label={`${fmtIsoDate(d)}${st === "busy" ? ", occupato" : st === "partial" ? ", occupato in parte" : ""}`}
                        className={cx(
                          "relative mx-auto grid h-11 w-full place-items-center text-[15px] font-semibold tabular transition-colors",
                          inRange && "bg-eu-soft",
                          d === start && (end || hover) && "rounded-l-full bg-eu-soft",
                          d === rangeEnd && "rounded-r-full bg-eu-soft",
                          disabled && "cursor-not-allowed text-ink-3/50",
                          st === "busy" && !tooEarly(d) && "hatch line-through",
                        )}
                      >
                        <span className={cx("grid size-10 place-items-center rounded-full", edge ? "bg-eu text-white" : !disabled && "hover:bg-concrete-2")}>
                          {Number(d.slice(8))}
                        </span>
                        {st === "partial" && !disabled && <span className="absolute bottom-1 size-1 rounded-full bg-signal" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line/70 pt-3 text-[13px] text-ink-2">
            <span className="flex items-center gap-2"><i className="hatch size-3.5 rounded-sm ring-1 ring-line" /> Occupato</span>
            <span className="flex items-center gap-2"><i className="size-1.5 rounded-full bg-signal" /> Occupato in parte: scegli bene gli orari</span>
          </div>
        </div>
      </fieldset>

      {/* 2. Orari */}
      <AnimatePresence initial={false}>
        {start && end && (
          <motion.fieldset initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <legend className="text-[19px] font-extrabold tracking-tight">A che ora?</legend>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">Ritiro · {fmtIsoDate(start)}</span>
                <select name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls}>
                  {slots.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">Riconsegna · {fmtIsoDate(end)}</span>
                <select name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls}>
                  {slots.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <p className={cx("mt-3 text-[15px] font-semibold", conflict || tooSoon || !ready ? "text-stop" : "text-go")} aria-live="polite">
              {!ready
                ? "La riconsegna deve essere dopo il ritiro."
                : tooSoon
                  ? `Servono almeno ${minNoticeHours} ore di preavviso: per urgenze chiamaci.`
                  : conflict
                    ? "In questi orari il mezzo è già occupato. Prova un altro orario."
                    : `Libero · ${fmtDuration(startAt, endAt)}`}
            </p>
          </motion.fieldset>
        )}
      </AnimatePresence>

      {/* 3. Dati */}
      <AnimatePresence initial={false}>
        {ready && (
          <motion.fieldset initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <legend className="text-[19px] font-extrabold tracking-tight">I tuoi dati</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { n: "firstName", l: "Nome", ac: "given-name" },
                { n: "lastName", l: "Cognome", ac: "family-name" },
                { n: "email", l: "Email", ac: "email", t: "email", im: "email" },
                { n: "phone", l: "Telefono", ac: "tel", t: "tel", im: "tel" },
              ].map((f) => (
                <label key={f.n} className="block">
                  <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">{f.l}</span>
                  <input
                    name={f.n}
                    type={f.t ?? "text"}
                    inputMode={f.im as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
                    autoComplete={f.ac}
                    required
                    maxLength={f.n === "email" ? 160 : 60}
                    aria-invalid={!!fe[f.n]}
                    className={cx(inputCls, fe[f.n] && "ring-2 ring-stop")}
                  />
                  {fe[f.n] && <span className="mt-1 block text-[13px] font-medium text-stop">{fe[f.n]}</span>}
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[15px] font-semibold text-ink-2">Messaggio (facoltativo)</span>
                <textarea name="notes" rows={3} maxLength={1000} placeholder="Es. mi serve per un trasloco, ho bisogno del gancio traino…" className={cx(inputCls, "h-auto py-3")} />
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-[15px] sm:col-span-2">
                <input type="checkbox" name="privacy" required className="mt-0.5 size-5 shrink-0 accent-eu" />
                <span>
                  Ho letto l&apos;
                  <a href="/privacy" target="_blank" className="font-semibold text-eu underline-offset-2 hover:underline">informativa privacy</a> e acconsento al trattamento dei dati per gestire la richiesta.
                </span>
              </label>
            </div>
            {turnstileSiteKey && <div ref={turnstileEl} className="mt-5 min-h-[65px]" />}
            {state.error && (
              <p role="alert" className="mt-5 rounded-xl bg-stop-soft px-4 py-3 text-[15px] font-semibold text-stop">
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || conflict || tooSoon || (!!turnstileSiteKey && !token)}
              className="mt-6 flex h-15 w-full items-center justify-center rounded-2xl bg-red px-6 text-[18px] font-extrabold text-white transition-[transform,background] hover:bg-red-deep active:scale-[0.99] disabled:opacity-50"
            >
              {pending ? "Invio in corso…" : `Richiedi ${vehicleName}`}
            </button>
            <p className="mt-3 text-center text-[13px] text-ink-3">Nessun pagamento ora. La prenotazione è valida solo dopo la nostra conferma.</p>
          </motion.fieldset>
        )}
      </AnimatePresence>
    </form>
  );
}
