"use client";

import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { moveBookingAction } from "@/app/admin/actions/bookings";
import { MobileAgenda } from "./mobile-agenda";
import { LinkButton, cx } from "@/components/ui";
import { addDays, diffDays, fmtDateTime, romeToUtc, toRomeDate, toRomeTime } from "@/lib/time";

type V = { id: string; name: string; plate: string; type: "auto" | "furgone"; status: string };
type B = { id: string; code: string; kind: "rental" | "block"; status: string; vehicleId: string; startAt: number; endAt: number; label: string };

const ROW = 64;
const SNAP_H = 0.5; // aggancio a mezz'ora
const WEEKDAY = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

function dayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return { wd: WEEKDAY.format(d).replace(".", ""), day: d.getUTCDate(), weekend: [0, 6].includes(d.getUTCDay()) };
}

const BAR: Record<string, string> = {
  pending: "bg-signal text-ink ring-1 ring-inset ring-[#d8a810]",
  confirmed: "bg-eu text-white",
  completed: "bg-[#9fb0d6] text-ink",
  block: "hatch bg-concrete-2 text-ink-2 ring-1 ring-inset ring-line",
};

type Drag = { id: string; startX: number; startY: number; dx: number; dy: number; moved: boolean };

export function Timeline({ start, days, today, selectedDay, vehicles, bookings: initial }: { start: string; days: number; today: string; selectedDay: string; vehicles: V[]; bookings: B[] }) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(72);
  const [bookings, setBookings] = useState(initial);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => setBookings(initial), [initial]);

  useLayoutEffect(() => {
    const update = () => setColW(window.innerWidth < 640 ? 52 : window.innerWidth < 1200 ? 64 : 76);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // All'apertura porta "oggi" in vista
  useEffect(() => {
    const idx = diffDays(start, today);
    if (scroller.current && idx >= 0 && idx < days) scroller.current.scrollLeft = Math.max(0, (idx - 1) * colW);
  }, [start, today, days, colW]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const x = (ms: number) => {
    const t = toRomeTime(ms).split(":").map(Number);
    return (diffDays(start, toRomeDate(ms)) + (t[0]! + t[1]! / 60) / 24) * colW;
  };
  const rowOf = new Map(vehicles.map((v, i) => [v.id, i]));
  const nowX = x(Date.now());
  const monthLabel = MONTH.format(new Date(`${addDays(start, 3)}T12:00:00Z`));

  // Sovrapposizioni nella stessa riga: impila le barre in "corsie"
  const lanes = useMemo(() => {
    const map = new Map<string, { lane: number; lanes: number }>();
    for (const v of vehicles) {
      const list = bookings.filter((b) => b.vehicleId === v.id).sort((a, b) => a.startAt - b.startAt);
      const ends: number[] = [];
      const assigned: { id: string; lane: number }[] = [];
      for (const b of list) {
        let lane = ends.findIndex((e) => e <= b.startAt);
        if (lane === -1) lane = ends.length;
        ends[lane] = b.endAt;
        assigned.push({ id: b.id, lane });
      }
      for (const a of assigned) map.set(a.id, { lane: a.lane, lanes: Math.max(1, ends.length) });
    }
    return map;
  }, [bookings, vehicles]);

  function onPointerDown(e: React.PointerEvent, b: B) {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // su touch: tocco = apri dettaglio, niente drag
    if (b.status === "completed") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: b.id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4 });
  }
  function onPointerUp(b: B) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      router.push(`/admin/prenotazioni/${b.id}`);
      return;
    }
    const hourShift = Math.round(((d.dx / colW) * 24) / SNAP_H) * SNAP_H;
    const rowShift = Math.round(d.dy / ROW);
    const targetRow = Math.min(vehicles.length - 1, Math.max(0, (rowOf.get(b.vehicleId) ?? 0) + rowShift));
    const target = vehicles[targetRow]!;
    if (hourShift === 0 && target.id === b.vehicleId) return;

    // Lo spostamento si calcola in ora locale: «+1 giorno» resta alla stessa ora anche col cambio dell'ora legale
    const shift = (ms: number) => {
      const [h, m] = toRomeTime(ms).split(":").map(Number);
      const total = h! * 60 + m! + hourShift * 60;
      const dayOff = Math.floor(total / 1440);
      const mins = ((total % 1440) + 1440) % 1440;
      return { date: addDays(toRomeDate(ms), dayOff), time: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}` };
    };
    const s = shift(b.startAt);
    const en = shift(b.endAt);
    const next = { ...b, vehicleId: target.id, startAt: romeToUtc(s.date, s.time), endAt: romeToUtc(en.date, en.time) };
    const notifies = b.kind === "rental" && b.status === "confirmed";
    const msg = `Spostare ${b.kind === "block" ? "il blocco" : `la prenotazione di ${b.label}`} su ${target.name}, dal ${fmtDateTime(next.startAt)} al ${fmtDateTime(next.endAt)}?${notifies ? "\n\nIl cliente riceverà un'email con le nuove date." : ""}`;
    if (!confirm(msg)) return;

    const prev = bookings;
    setBookings((list) => list.map((x) => (x.id === b.id ? next : x)));
    startTransition(async () => {
      const r = await moveBookingAction(b.id, { vehicleId: target.id, startDate: s.date, startTime: s.time, endDate: en.date, endTime: en.time, notify: true });
      if (r.error) {
        setBookings(prev);
        setToast({ tone: "err", text: r.error });
      } else {
        setToast({ tone: "ok", text: "Prenotazione spostata" });
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-wide text-[26px] font-extrabold tracking-tight md:text-[32px]">Calendario</h1>
          <p className="hidden text-[15px] capitalize text-ink-3 md:block">{monthLabel}</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href={`/admin/calendario?da=${addDays(start, -14)}`} className="grid size-11 place-items-center rounded-xl bg-paper ring-1 ring-line hover:ring-ink-3" aria-label="Settimane precedenti">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href="/admin/calendario" className="h-11 rounded-xl bg-paper px-4 text-[15px] font-semibold leading-[44px] ring-1 ring-line hover:ring-ink-3">
            Oggi
          </Link>
          <Link href={`/admin/calendario?da=${addDays(start, 14)}`} className="grid size-11 place-items-center rounded-xl bg-paper ring-1 ring-line hover:ring-ink-3" aria-label="Settimane successive">
            <ChevronRight className="size-5" />
          </Link>
          <LinkButton href="/admin/prenotazioni/nuova" className="ml-1 hidden sm:inline-flex">
            <Plus className="size-4" /> Nuova
          </LinkButton>
        </div>
      </div>

      <div className="mb-3 hidden flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-ink-2 md:flex">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-signal" /> Da confermare</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-eu" /> Confermata</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-[#9fb0d6]" /> Conclusa</span>
        <span className="flex items-center gap-1.5"><i className="hatch size-3 rounded bg-concrete-2 ring-1 ring-line" /> Blocco</span>
        <span className="hidden text-ink-3 md:inline">Trascina una barra per spostarla · clicca uno spazio vuoto per prenotare</span>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl bg-paper p-10 text-center ring-1 ring-line/70">
          <p className="font-bold">La flotta è vuota</p>
          <LinkButton href="/admin/flotta/nuovo" className="mt-4">Aggiungi il primo veicolo</LinkButton>
        </div>
      ) : (
        <>
          <MobileAgenda start={start} days={days} today={today} selectedDay={selectedDay} vehicles={vehicles} bookings={bookings} />
          <div className="hidden overflow-hidden rounded-2xl bg-paper ring-1 ring-line/70 md:block">
          <div ref={scroller} className="relative overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: "thin" }}>
            <div className="relative" style={{ width: days * colW + 168 }}>
              {/* Intestazione giorni */}
              <div className="sticky top-0 z-20 flex border-b border-line bg-paper">
                <div className="sticky left-0 z-30 w-[168px] shrink-0 border-r border-line bg-paper" />
                {dates.map((d) => {
                  const l = dayLabel(d);
                  const isToday = d === today;
                  return (
                    <div key={d} style={{ width: colW }} className={cx("shrink-0 py-2 text-center", l.weekend && "bg-concrete/60")}>
                      <p className={cx("text-[11px] font-semibold uppercase", isToday ? "text-eu" : "text-ink-3")}>{l.wd}</p>
                      <p className={cx("mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[15px] font-bold tabular", isToday && "bg-eu text-white")}>{l.day}</p>
                    </div>
                  );
                })}
              </div>

              <div className="relative">
              {/* Righe veicoli */}
              {vehicles.map((v) => (
                <div key={v.id} className="relative flex border-b border-line/60 last:border-b-0" style={{ height: ROW }}>
                  <div className="sticky left-0 z-10 flex w-[168px] shrink-0 flex-col justify-center border-r border-line bg-paper px-3">
                    <p className="truncate text-[13px] font-bold leading-tight">{v.name}</p>
                    <p className="font-narrow text-xs font-bold tracking-wider text-ink-3">
                      {v.plate}
                      {v.status === "maintenance" && <span className="ml-1.5 font-sans text-[11px] font-semibold tracking-normal text-stop">officina</span>}
                    </p>
                  </div>
                  {dates.map((d) => (
                    <Link
                      key={d}
                      href={`/admin/prenotazioni/nuova?v=${v.id}&d=${d}`}
                      style={{ width: colW }}
                      className={cx("shrink-0 border-r border-line/40 transition-colors hover:bg-eu-soft/60", dayLabel(d).weekend && "bg-concrete/40")}
                      aria-label={`Nuova prenotazione ${v.name} il ${d}`}
                      tabIndex={-1}
                    />
                  ))}
                </div>
              ))}

              {/* Linea "adesso" */}
              {nowX > 0 && nowX < days * colW && (
                <div className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-stop" style={{ left: 168 + nowX }}>
                  <span className="absolute -left-[3px] -top-1 size-2 rounded-full bg-stop" />
                </div>
              )}

              {/* Barre prenotazioni */}
              <div className="pointer-events-none absolute inset-y-0 right-0 z-[6]" style={{ left: 168 }}>
                {bookings.map((b) => {
                  const row = rowOf.get(b.vehicleId);
                  if (row === undefined) return null;
                  const L = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
                  const left = Math.max(0, x(b.startAt));
                  const right = Math.min(days * colW, x(b.endAt));
                  if (right <= 0 || left >= days * colW) return null;
                  const h = (ROW - 12) / L.lanes;
                  const isDrag = drag?.id === b.id && drag.moved;
                  const key = b.kind === "block" ? "block" : b.status;
                  return (
                    <motion.button
                      key={b.id}
                      layout={!isDrag}
                      type="button"
                      onPointerDown={(e) => onPointerDown(e, b)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => onPointerUp(b)}
                      onClick={(e) => {
                        // Tastiera e touch: apri il dettaglio
                        if ((e.nativeEvent as PointerEvent).pointerType !== "mouse") router.push(`/admin/prenotazioni/${b.id}`);
                      }}
                      title={`${b.label} · ${fmtDateTime(b.startAt)} → ${fmtDateTime(b.endAt)}`}
                      className={cx(
                        "pointer-events-auto absolute flex items-center gap-1.5 overflow-hidden rounded-lg px-2 text-left text-[12px] font-semibold leading-tight",
                        BAR[key],
                        b.status !== "completed" && "cursor-grab active:cursor-grabbing",
                        isDrag && "z-20 opacity-90 shadow-xl ring-2 ring-ink",
                      )}
                      style={{
                        top: row * ROW + 6 + L.lane * h,
                        left,
                        width: Math.max(10, right - left - 2),
                        height: h - 2,
                        transform: isDrag ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
                      }}
                    >
                      {b.kind === "block" && <Lock className="size-3 shrink-0" />}
                      <span className="truncate">{b.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className={cx(
              "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg md:bottom-8",
              toast.tone === "ok" ? "bg-ink text-white" : "bg-stop text-white",
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
