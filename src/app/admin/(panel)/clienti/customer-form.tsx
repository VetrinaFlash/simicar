"use client";

import { useActionState } from "react";
import type { CustomerFormState } from "@/app/admin/actions/customers";
import { Button, Checkbox, Field, FormError, Input, Panel, PanelHeader, Textarea } from "@/components/ui";
import type { schema } from "@/lib/db/schema-types";

type Customer = typeof schema.customers.$inferSelect;

export function CustomerForm({
  customer,
  action,
  submitLabel,
}: {
  customer?: Customer;
  action: (p: CustomerFormState, f: FormData) => Promise<CustomerFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const c = customer;
  return (
    <form action={formAction} className="space-y-5">
      <Panel>
        <PanelHeader title="Anagrafica" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Nome"><Input name="firstName" defaultValue={c?.firstName} required /></Field>
          <Field label="Cognome"><Input name="lastName" defaultValue={c?.lastName} required /></Field>
          <Field label="Telefono"><Input name="phone" type="tel" inputMode="tel" defaultValue={c?.phone ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" inputMode="email" defaultValue={c?.email ?? ""} /></Field>
          <Field label="Data di nascita"><Input name="birthDate" type="date" defaultValue={c?.birthDate ?? ""} /></Field>
          <Field label="Luogo di nascita"><Input name="birthPlace" defaultValue={c?.birthPlace ?? ""} /></Field>
          <Field label="Cittadinanza"><Input name="citizenship" defaultValue={c?.citizenship ?? ""} placeholder="Italiana" /></Field>
          <Field label="Codice fiscale"><Input name="taxCode" defaultValue={c?.taxCode ?? ""} maxLength={16} className="uppercase" /></Field>
          <Field label="Indirizzo di residenza" className="sm:col-span-2"><Input name="address" defaultValue={c?.address ?? ""} /></Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Patente e documento" sub="Dati richiesti per il contratto e per la comunicazione alla Polizia (CaRGOS)." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Numero patente"><Input name="licenseNumber" defaultValue={c?.licenseNumber ?? ""} className="uppercase" /></Field>
          <Field label="Scadenza patente"><Input name="licenseExpiry" type="date" defaultValue={c?.licenseExpiry ?? ""} /></Field>
          <Field label="Patente rilasciata da"><Input name="licenseIssuedBy" defaultValue={c?.licenseIssuedBy ?? ""} placeholder="MIT-UCO" /></Field>
          <Field label="Tipo documento"><Input name="docType" defaultValue={c?.docType ?? ""} placeholder="Carta d'identità" /></Field>
          <Field label="Numero documento"><Input name="docNumber" defaultValue={c?.docNumber ?? ""} className="uppercase" /></Field>
          <Field label="Scadenza documento"><Input name="docExpiry" type="date" defaultValue={c?.docExpiry ?? ""} /></Field>
          <Field label="Documento rilasciato da"><Input name="docIssuedBy" defaultValue={c?.docIssuedBy ?? ""} placeholder="Comune di …" /></Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Note" />
        <div className="space-y-4 px-5 pb-5">
          <Textarea name="notes" defaultValue={c?.notes ?? ""} rows={3} maxLength={2000} />
          <Checkbox name="blacklisted" defaultChecked={c?.blacklisted} label="Lista nera: segnala le sue prossime richieste" />
          <Field label="Motivo"><Input name="blacklistReason" defaultValue={c?.blacklistReason ?? ""} maxLength={300} /></Field>
        </div>
      </Panel>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvataggio…" : submitLabel}</Button>
        {state.ok && !pending && <span className="text-sm font-semibold text-go">Salvato</span>}
        <div className="flex-1"><FormError message={state.error} /></div>
      </div>
    </form>
  );
}
