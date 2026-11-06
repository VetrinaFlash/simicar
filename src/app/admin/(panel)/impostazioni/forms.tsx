"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "@/app/admin/actions/auth";
import { saveSettingsAction, type SettingsState } from "@/app/admin/actions/settings";
import { Button, Field, FormError, Input, Panel, PanelHeader, Textarea } from "@/components/ui";
import type { Settings } from "@/lib/settings";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="space-y-5">
      <Panel>
        <PanelHeader title="La tua attività" sub="Compare sul sito, nelle email e nei contratti." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Nome dell'attività"><Input name="businessName" defaultValue={s.businessName} required /></Field>
          <Field label="Città"><Input name="city" defaultValue={s.city} /></Field>
          <Field label="Indirizzo per il ritiro" className="sm:col-span-2"><Input name="address" defaultValue={s.address} /></Field>
          <Field label="Link Google Maps"><Input name="mapsUrl" type="url" defaultValue={s.mapsUrl} placeholder="https://maps.app.goo.gl/…" /></Field>
          <Field label="Partita IVA"><Input name="vatNumber" defaultValue={s.vatNumber} /></Field>
          <Field label="Telefono"><Input name="phone" type="tel" defaultValue={s.phone} /></Field>
          <Field label="WhatsApp" hint="Numero con prefisso, es. +39 333 1234567"><Input name="whatsapp" type="tel" defaultValue={s.whatsapp} /></Field>
          <Field label="Email pubblica" hint="I clienti rispondono a questo indirizzo"><Input name="email" type="email" defaultValue={s.email} /></Field>
          <Field label="Email per le nuove richieste" hint="Se vuota, uso l'email pubblica"><Input name="notifyEmail" type="email" defaultValue={s.notifyEmail} /></Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Orari e richieste online" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <Field label="Orari (testo sul sito)" className="sm:col-span-3"><Input name="hours" defaultValue={s.hours} /></Field>
          <Field label="Ritiri dalle"><Input name="openFrom" type="time" defaultValue={s.openFrom} required /></Field>
          <Field label="Riconsegne fino alle"><Input name="openTo" type="time" defaultValue={s.openTo} required /></Field>
          <Field label="Preavviso minimo (ore)"><Input name="minNoticeHours" type="number" min={0} max={240} defaultValue={s.minNoticeHours} /></Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Testi della pagina principale" />
        <div className="space-y-4 px-5 pb-5">
          <Field label="Titolo"><Input name="heroTitle" defaultValue={s.heroTitle} maxLength={120} required /></Field>
          <Field label="Sottotitolo"><Textarea name="heroText" defaultValue={s.heroText} maxLength={300} rows={2} /></Field>
        </div>
      </Panel>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvataggio…" : "Salva impostazioni"}</Button>
        {state.ok && !pending && <span className="text-sm font-semibold text-go">Impostazioni salvate</span>}
        <div className="flex-1"><FormError message={state.error} /></div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <Field label="Password attuale"><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nuova password" hint="Almeno 12 caratteri"><Input name="next" type="password" autoComplete="new-password" minLength={12} required /></Field>
      <Field label="Ripeti la nuova password"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" variant="secondary" disabled={pending}>Cambia password</Button>
        {state.ok && <span className="text-sm font-semibold text-go">Password aggiornata. Gli altri dispositivi sono stati disconnessi.</span>}
        <FormError message={state.error} />
      </div>
    </form>
  );
}
