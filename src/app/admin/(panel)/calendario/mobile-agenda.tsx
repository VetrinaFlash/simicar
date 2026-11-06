"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { addDays, diffDays, fmtDateTime, romeToUtc, toRomeDate, toRomeTime } from "@/lib/time";

type Vehicle = {
  id: string;
  name: string;
  plate: string;
  type: "auto" | "furgone";
  status: string;
};

type Booking = {
  id: string;
  code: string;
  kind: "rental" | "block";
  status: string;
  vehicleId: string;
  startAt: number;
  endAt: number;
  label: string;
};

const dayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
const fullFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dateUTC = (date: string) => new Date(`${date}T12:00:00Z`);

const states: Record<string, { label: string; className: string }> = {
  pending: { label: "Da confermare", className: "bg-signal-soft text-[#715000]" },
  confirmed: { label: "Confermata", className: "bg-eu-soft text-eu" },
  completed: { label: "Conclusa", className: "bg-go-soft text-go" },
  rejected: { label: "Rifiutata", className: "bg-stop-soft text-stop" },
  cancelled: { label: "Annullata", className: "bg-concrete-2 text-ink-2" },
};

function Period({ booking, selectedDate }: { booking: Booking; selectedDate: string }) {
  const sameDay = toRomeDate(booking.startAt) === selectedDate && toRomeDate(booking.endAt) === selectedDate;
  if (sameDay) return <span>{toRomeTime(booking.startAt)} – {toRomeTime(booking.endAt)}</span>;
  return (
    <span className="block leading-relaxed">
      <span className="block">Dal {fmtDateTime(booking.startAt)}</span>
      <span className="block">Al {fmtDateTime(booking.endAt)}</span>
    </span>
  );
}

/**
 * Vista a giornata per telefoni: nessuna timeline da rimpicciolire o trascinare.
 * Le prenotazioni che attraversano la mezzanotte sono visibili in tutti i giorni interessati.
 */
export function MobileAgenda({
  start,
  days,
  today,
  selectedDay,
  vehicles,
  bookings,
}: {
  start: string;
  days: number;
  today: string;
  selectedDay: string;
  vehicles: Vehicle[];
  bookings: Booking[];
}) {
  const router = useRouter();
  const strip = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(selectedDay);
  useEffect(() => setSelected(selectedDay), [selectedDay]);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [days, start]);
  const dayStart = useMemo(() => romeToUtc(selected), [selected]);
  const dayEnd = useMemo(() => romeToUtc(addDays(selected, 1)), [selected]);
  const visible = useMemo(
    () => bookings.filter((b) => b.startAt < dayEnd && b.endAt > dayStart && b.status !== "cancelled" && b.status !== "rejected"),
    [bookings, dayEnd, dayStart],
  );
  const byVehicle = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const b of visible) grouped.set(b.vehicleId, [...(grouped.get(b.vehicleId) ?? []), b]);
    for (const list of grouped.values()) list.sort((a, b) => a.startAt - b.startAt);
    return grouped;
  }, [visible]);

  useEffect(() => {
    const container = strip.current;
    const target = container?.querySelector<HTMLElement>(`[data-calendar-day="${selected}"]`);
    if (!container || !target) return;
    container.scrollTo({
      left: target.offsetLeft - (container.clientWidth - target.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [selected, start]);

  function chooseDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateUTC(date).getTime())) return;
    const index = diffDays(start, date);
    if (index < 0 || index >= days) {
      // Il server deve caricare le prenotazioni del nuovo intervallo.
      router.push(`/admin/calendario?da=${addDays(date, -3)}&giorno=${date}`);
    } else {
      setSelected(date);
    }
  }

  const reserved = visible.filter((b) => b.kind !== "block");
  const pending = reserved.filter((b) => b.status === "pending").length;
  const month = monthFormatter.format(dateUTC(selected));
  const selectedLabel = fullFormatter.format(dateUTC(selected));

  return (
    <section className="space-y-4 md:hidden" aria-label="Calendario giornaliero">
      <div className="rounded-2xl bg-paper p-3 ring-1 ring-line/70">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-3">Giorno selezionato</p>
            <p className="truncate text-base font-extrabold capitalize text-ink">{month}</p>
          </div>
          <label className="relative flex h-11 min-w-0 items-center gap-2 rounded-xl bg-concrete px-3 text-sm font-semibold text-ink ring-1 ring-line">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-eu" />
            <span className="sr-only">Vai a una data</span>
            <input
              aria-label="Vai a una data"
              type="date"
              value={selected}
              onChange={(event) => chooseDate(event.target.value)}
              className="w-[118px] min-w-0 bg-transparent text-sm font-semibold outline-none"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Giorno precedente"
            onClick={() => chooseDate(addDays(selected, -1))}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-concrete text-ink"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div ref={strip} className="relative flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]" aria-label="Seleziona giorno">
            {dates.map((date) => {
              const isSelected = date === selected;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  data-calendar-day={date}
                  type="button"
                  onClick={() => chooseDate(date)}
                  aria-pressed={isSelected}
                  aria-label={fullFormatter.format(dateUTC(date))}
                  className={cx(
                    "flex w-[54px] shrink-0 snap-center flex-col items-center gap-1 rounded-xl px-1 py-2 text-center",
                    isSelected ? "bg-eu text-white" : "bg-concrete text-ink",
                    isToday && !isSelected && "ring-2 ring-inset ring-eu",
                  )}
                >
                  <span className={cx("text-[11px] font-semibold uppercase", isSelected ? "text-white/80" : "text-ink-3")}>
                    {dayFormatter.format(dateUTC(date)).replace(".", "")}
                  </span>
                  <span className="text-base font-extrabold tabular">{dateUTC(date).getUTCDate()}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Giorno successivo"
            onClick={() => chooseDate(addDays(selected, 1))}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-concrete text-ink"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-extrabold capitalize">{selectedLabel}</p>
          <p className="text-sm text-ink-3">
            {reserved.length} {reserved.length === 1 ? "prenotazione" : "prenotazioni"}
            {pending > 0 && ` · ${pending} da confermare`}
          </p>
        </div>
        <Link
          href={`/admin/prenotazioni/nuova?d=${selected}`}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-eu px-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> Nuova
        </Link>
      </div>

      <div className="space-y-3">
        {vehicles.map((v) => {
          const list = byVehicle.get(v.id) ?? [];
          return (
            <article key={v.id} className="min-w-0 overflow-hidden rounded-2xl bg-paper ring-1 ring-line/70">
              <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-bold">{v.name}</h2>
                  <p className="font-narrow text-xs font-bold tracking-wide text-ink-3">{v.plate}</p>
                </div>
                <span className={cx(
                  "shrink-0 rounded-lg px-2 py-1 text-xs font-semibold",
                  v.status === "maintenance" ? "bg-stop-soft text-stop" : list.length > 0 ? "bg-eu-soft text-eu" : "bg-go-soft text-go",
                )}>
                  {v.status === "maintenance" ? "In officina" : list.length > 0 ? `${list.length} ${list.length === 1 ? "impegno" : "impegni"}` : "Nessun impegno"}
                </span>
              </div>
              {list.length > 0 ? (
                <div className="space-y-2 border-t border-line/60 px-3 py-3">
                  {list.map((b) => {
                    const status = b.kind === "block"
                      ? { label: "Blocco", className: "bg-concrete-2 text-ink-2" }
                      : states[b.status] ?? { label: b.status, className: "bg-concrete-2 text-ink-2" };
                    return (
                      <Link
                        key={b.id}
                        href={`/admin/prenotazioni/${b.id}`}
                        className="block min-w-0 rounded-xl border border-line/70 bg-concrete/40 p-3 active:bg-eu-soft"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-ink">
                              {b.kind === "block" && <Lock className="mr-1 inline size-3.5" />}
                              {b.label || (b.kind === "block" ? "Blocco" : "Prenotazione")}
                            </p>
                            {b.kind !== "block" && <p className="mt-0.5 text-xs text-ink-3">{b.code}</p>}
                          </div>
                          <span className={cx("shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold", status.className)}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-ink-2">
                          <Period booking={b} selectedDate={selected} />
                        </p>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 border-t border-line/60 px-4 py-2.5">
                  <p className="text-xs text-ink-3">{v.status === "maintenance" ? "Veicolo in manutenzione" : "Nessuna prenotazione per il giorno"}</p>
                  {v.status !== "maintenance" && (
                    <Link href={`/admin/prenotazioni/nuova?v=${v.id}&d=${selected}`} className="shrink-0 text-xs font-bold text-eu">
                      + Prenota
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
