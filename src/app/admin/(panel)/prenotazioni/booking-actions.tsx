"use client";

import { Check, FileText, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useActionState, useState, useTransition } from "react";
import {
  cancelBookingAction,
  checkoutAction,
  confirmBookingAction,
  moveBookingFormAction,
  rejectBookingAction,
  returnAction,
  setCargosSentAction,
  updateBookingDetailsAction,
  type ActionResult,
} from "@/app/admin/actions/bookings";
import { Button, Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui";

const euro = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Conferma o rifiuta una richiesta. Usato nella lista richieste e nel dettaglio. */
export function DecisionPanel({
  bookingId,
  depositEur,
  priceEur,
  compact = false,
}: {
  bookingId: string;
  depositEur?: number | null;
  priceEur?: number | null;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "confirm" | "reject">(compact ? "idle" : "confirm");
  const [cState, confirm, confirming] = useActionState<ActionResult, FormData>(confirmBookingAction.bind(null, bookingId), {});
  const [rState, reject, rejecting] = useActionState<ActionResult, FormData>(rejectBookingAction.bind(null, bookingId), {});

  if (cState.ok || rState.ok)
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${cState.ok ? "bg-go-soft text-go" : "bg-concrete-2 text-ink-2"}`}
      >
        {cState.ok ? <Check className="size-4" /> : <X className="size-4" />}
        {cState.ok ? "Confermata. Il cliente ha ricevuto l'email." : "Rifiutata. Il cliente è stato avvisato."}
      </motion.p>
    );

  return (
    <div>
      {mode === "idle" && (
        <div className="flex gap-2">
          <Button variant="success" className="flex-1" onClick={() => setMode("confirm")}>
            <Check className="size-4" /> Conferma
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => setMode("reject")}>
            <X className="size-4" /> Rifiuta
          </Button>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {mode === "confirm" && (
          <motion.form
            key="c"
            action={confirm}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prezzo concordato (€)" hint="Facoltativo, compare nell'email">
                <Input name="priceEur" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={euro(priceEur)} />
              </Field>
              <Field label="Cauzione (€)">
                <Input name="depositEur" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={euro(depositEur)} />
              </Field>
            </div>
            <FormError message={cState.error} />
            <div className="flex gap-2">
              <Button type="submit" variant="success" className="flex-1" disabled={confirming}>
                {confirming ? "Conferma in corso…" : "Conferma e invia email"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(compact ? "idle" : "reject")}>
                {compact ? "Indietro" : "Rifiuta"}
              </Button>
            </div>
          </motion.form>
        )}
        {mode === "reject" && (
          <motion.form
            key="r"
            action={reject}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <Field label="Motivo per il cliente" hint="Facoltativo, es. «Disponibile da giovedì»">
              <Textarea name="reason" rows={2} maxLength={500} />
            </Field>
            <FormError message={rState.error} />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" className="flex-1" disabled={rejecting}>
                {rejecting ? "Invio…" : "Rifiuta e avvisa il cliente"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(compact ? "idle" : "confirm")}>
                Indietro
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function FuelSelect({ name, defaultValue }: { name: string; defaultValue?: number | null }) {
  return (
    <Select name={name} defaultValue={defaultValue == null ? "" : String(defaultValue)}>
      <option value="">—</option>
      {[8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
        <option key={n} value={n}>
          {n === 8 ? "Pieno" : n === 0 ? "Riserva" : n === 4 ? "Metà" : `${n}/8`}
        </option>
      ))}
    </Select>
  );
}

export function HandoverForms({
  bookingId,
  kmOut,
  fuelOut,
  mileage,
}: {
  bookingId: string;
  kmOut: number | null;
  fuelOut: number | null;
  mileage: number | null;
}) {
  const [out, outAction, outPending] = useActionState<ActionResult, FormData>(checkoutAction.bind(null, bookingId), {});
  const [ret, retAction, retPending] = useActionState<ActionResult, FormData>(returnAction.bind(null, bookingId), {});
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <form action={outAction} className="space-y-3">
        <p className="text-sm font-bold">Consegna al cliente</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Km">
            <Input name="kmOut" type="number" inputMode="numeric" min={0} defaultValue={kmOut ?? mileage ?? ""} />
          </Field>
          <Field label="Carburante">
            <FuelSelect name="fuelOut" defaultValue={fuelOut} />
          </Field>
        </div>
        <FormError message={out.error} />
        <Button type="submit" variant="secondary" className="w-full" disabled={outPending}>
          {out.ok ? "Consegna registrata" : "Registra consegna"}
        </Button>
      </form>
      <form action={retAction} className="space-y-3">
        <p className="text-sm font-bold">Rientro</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Km">
            <Input name="kmIn" type="number" inputMode="numeric" min={kmOut ?? 0} />
          </Field>
          <Field label="Carburante">
            <FuelSelect name="fuelIn" />
          </Field>
        </div>
        <FormError message={ret.error} />
        <Button type="submit" className="w-full" disabled={retPending}>
          Registra rientro e chiudi
        </Button>
      </form>
    </div>
  );
}

export function DetailsForm({
  bookingId,
  priceEur,
  depositEur,
  internalNotes,
  isBlock,
}: {
  bookingId: string;
  priceEur: number | null;
  depositEur: number | null;
  internalNotes: string | null;
  isBlock: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateBookingDetailsAction.bind(null, bookingId), {});
  return (
    <form action={action} className="space-y-3">
      {!isBlock && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prezzo (€)">
            <Input name="priceEur" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={euro(priceEur)} />
          </Field>
          <Field label="Cauzione (€)">
            <Input name="depositEur" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={euro(depositEur)} />
          </Field>
        </div>
      )}
      <Field label="Note interne" hint="Le vedi solo tu">
        <Textarea name="internalNotes" rows={3} maxLength={2000} defaultValue={internalNotes ?? ""} />
      </Field>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Salva
        </Button>
        {state.ok && !pending && <span className="text-sm font-semibold text-go">Salvato</span>}
      </div>
    </form>
  );
}

export function MoveForm({
  bookingId,
  vehicles,
  value,
  canNotify,
}: {
  bookingId: string;
  vehicles: { id: string; name: string }[];
  value: { vehicleId: string; startDate: string; startTime: string; endDate: string; endTime: string };
  canNotify: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(moveBookingFormAction.bind(null, bookingId), {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Veicolo">
        <Select name="vehicleId" defaultValue={value.vehicleId}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Ritiro">
          <Input name="startDate" type="date" defaultValue={value.startDate} required />
        </Field>
        <Field label="Ora">
          <Input name="startTime" type="time" step={900} defaultValue={value.startTime} required />
        </Field>
        <Field label="Riconsegna">
          <Input name="endDate" type="date" defaultValue={value.endDate} required />
        </Field>
        <Field label="Ora">
          <Input name="endTime" type="time" step={900} defaultValue={value.endTime} required />
        </Field>
      </div>
      {canNotify && <Checkbox name="notify" defaultChecked label="Avvisa il cliente via email" />}
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Aggiorna date
        </Button>
        {state.ok && !pending && <span className="text-sm font-semibold text-go">Aggiornata</span>}
      </div>
    </form>
  );
}

export function CancelBooking({ bookingId, canNotify }: { bookingId: string; canNotify: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  return (
    <div className="space-y-3">
      {canNotify && <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Avvisa il cliente via email" />}
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Annullare la prenotazione? Il mezzo tornerà libero.")) return;
          start(async () => {
            const r = await cancelBookingAction(bookingId, canNotify && notify);
            if (r.error) setError(r.error);
          });
        }}
      >
        {pending ? "Annullamento…" : "Annulla prenotazione"}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function DocumentsPanel({ bookingId, cargosSentAt }: { bookingId: string; cargosSentAt: number | null }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(cargosSentAt);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <a href={`/api/admin/bookings/${bookingId}/pdf?tipo=contratto`} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-paper text-[15px] font-semibold ring-1 ring-line hover:ring-ink-3">
          <FileText className="size-4" /> Contratto PDF
        </a>
        <a href={`/api/admin/bookings/${bookingId}/pdf?tipo=cargos`} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-paper text-[15px] font-semibold ring-1 ring-line hover:ring-ink-3">
          <ShieldCheck className="size-4" /> Scheda CaRGOS
        </a>
      </div>
      <Checkbox
        checked={!!sent}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          setSent(v ? Date.now() : null);
          start(async () => {
            const r = await setCargosSentAction(bookingId, v);
            if (r.error) setSent(cargosSentAt);
          });
        }}
        label={sent ? `Dati inviati a CaRGOS (${new Date(sent).toLocaleDateString("it-IT")})` : "Segna come inviato a CaRGOS"}
      />
    </div>
  );
}
