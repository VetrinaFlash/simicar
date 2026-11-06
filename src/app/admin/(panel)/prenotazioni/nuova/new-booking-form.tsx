"use client";

import { Search, UserPlus, X } from "lucide-react";
import { motion } from "motion/react";
import { useActionState, useMemo, useState } from "react";
import { createAdminBookingAction, type ActionResult } from "@/app/admin/actions/bookings";
import { Button, Checkbox, Field, FormError, Input, Panel, Select, Textarea, cx } from "@/components/ui";

type Customer = { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; blacklisted: boolean };

export function NewBookingForm({
  vehicles,
  customers,
  defaults,
}: {
  vehicles: { id: string; name: string; plate: string; deposit: number | null }[];
  customers: Customer[];
  defaults: { kind: "rental" | "block"; vehicleId: string; customerId: string; startDate: string; endDate: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createAdminBookingAction, {});
  const [kind, setKind] = useState(defaults.kind);
  const [vehicleId, setVehicleId] = useState(defaults.vehicleId);
  const [customerId, setCustomerId] = useState(defaults.customerId);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = customers.find((c) => c.id === customerId);
  const deposit = vehicles.find((v) => v.id === vehicleId)?.deposit;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return customers
      .filter((c) => `${c.firstName} ${c.lastName} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, customers]);

  if (vehicles.length === 0)
    return <Panel className="p-6 text-center text-ink-2">Aggiungi prima un veicolo alla flotta.</Panel>;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <div className="relative grid h-11 grid-cols-2 rounded-xl bg-concrete-2 p-1">
        {(["rental", "block"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cx("relative rounded-[9px] text-[15px] font-semibold", kind === k ? "text-ink" : "text-ink-3")}>
            {kind === k && <motion.span layoutId="kind" className="absolute inset-0 rounded-[9px] bg-paper shadow-sm ring-1 ring-line/60" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
            <span className="relative">{k === "rental" ? "Noleggio" : "Blocco (officina, uso interno)"}</span>
          </button>
        ))}
      </div>

      <Panel className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Veicolo" className="sm:col-span-2">
          <Select name="vehicleId" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.plate}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Dal">
            <Input name="startDate" type="date" defaultValue={defaults.startDate} required />
          </Field>
          <Field label="Ora">
            <Input name="startTime" type="time" step={900} defaultValue="09:00" required />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Al">
            <Input name="endDate" type="date" defaultValue={defaults.endDate} required />
          </Field>
          <Field label="Ora">
            <Input name="endTime" type="time" step={900} defaultValue="09:00" required />
          </Field>
        </div>
      </Panel>

      {kind === "rental" && (
        <Panel className="p-5">
          <p className="mb-3 text-[15px] font-bold">Cliente</p>
          <input type="hidden" name="customerId" value={creating ? "" : customerId} />
          {selected && !creating ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-concrete p-3.5">
              <div>
                <p className="font-semibold">
                  {selected.firstName} {selected.lastName}
                  {selected.blacklisted && <span className="ml-2 text-xs font-bold text-stop">Lista nera</span>}
                </p>
                <p className="text-sm text-ink-3">{[selected.phone, selected.email].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => setCustomerId("")} className="grid size-9 place-items-center rounded-full hover:bg-concrete-2" aria-label="Cambia cliente">
                <X className="size-4" />
              </button>
            </div>
          ) : creating ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><Input name="newFirstName" required /></Field>
              <Field label="Cognome"><Input name="newLastName" required /></Field>
              <Field label="Telefono"><Input name="newPhone" type="tel" inputMode="tel" /></Field>
              <Field label="Email"><Input name="newEmail" type="email" inputMode="email" /></Field>
              <button type="button" onClick={() => setCreating(false)} className="text-left text-sm font-semibold text-eu sm:col-span-2">
                Cerca tra i clienti esistenti
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome, telefono o email" className="pl-10" />
              </div>
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-line/60 rounded-xl ring-1 ring-line">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCustomerId(c.id)} className="w-full px-3.5 py-2.5 text-left hover:bg-concrete">
                        <span className="font-semibold">{c.firstName} {c.lastName}</span>
                        <span className="ml-2 text-sm text-ink-3">{c.phone ?? c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setCreating(true)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-eu">
                <UserPlus className="size-4" /> Nuovo cliente
              </button>
            </div>
          )}
        </Panel>
      )}

      <Panel className="grid gap-4 p-5 sm:grid-cols-2">
        {kind === "rental" && (
          <>
            <Field label="Prezzo concordato (€)">
              <Input name="priceEur" type="number" inputMode="decimal" step="0.01" min={0} />
            </Field>
            <Field label="Cauzione (€)">
              <Input key={vehicleId} name="depositEur" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={deposit ?? ""} />
            </Field>
          </>
        )}
        <Field label={kind === "block" ? "Motivo" : "Note interne"} className="sm:col-span-2">
          <Textarea name="internalNotes" rows={2} maxLength={2000} placeholder={kind === "block" ? "Es. tagliando, carrozzeria" : undefined} />
        </Field>
        {kind === "rental" && <Checkbox name="sendEmail" defaultChecked label="Invia la conferma via email al cliente" className="sm:col-span-2" />}
      </Panel>

      <FormError message={state.error} />
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Salvataggio…" : kind === "block" ? "Blocca il mezzo" : "Salva prenotazione"}
      </Button>
    </form>
  );
}
