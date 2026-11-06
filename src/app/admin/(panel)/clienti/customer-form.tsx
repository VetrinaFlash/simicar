"use client";

import { useActionState } from "react";
import type { CustomerFormState } from "@/app/admin/actions/customers";
import { PlacePicker } from "@/components/place-picker";
import { Button, Checkbox, Field, FormError, Input, Panel, PanelHeader, Select, Textarea } from "@/components/ui";
import { CARGOS_DOC_TYPES, ITALIA_CODE } from "@/lib/cargos-tables";
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
          <Field label="Nome"><Input name="firstName" defaultValue={c?.firstName} required autoComplete="off" /></Field>
          <Field label="Cognome"><Input name="lastName" defaultValue={c?.lastName} required autoComplete="off" /></Field>
          <Field label="Telefono"><Input name="phone" type="tel" inputMode="tel" defaultValue={c?.phone ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" inputMode="email" defaultValue={c?.email ?? ""} /></Field>
          <Field label="Data di nascita"><Input name="birthDate" type="date" defaultValue={c?.birthDate ?? ""} /></Field>
          <Field label="Luogo di nascita" hint="Comune italiano o stato estero">
            <PlacePicker codeName="birthPlaceCode" textName="birthPlace" defaultCode={c?.birthPlaceCode} defaultText={c?.birthPlace} placeholder="Cerca comune o stato" />
          </Field>
          <Field label="Cittadinanza">
            <PlacePicker
              codeName="citizenshipCode"
              textName="citizenship"
              kind="stato"
              defaultCode={c ? c.citizenshipCode : ITALIA_CODE}
              defaultText={c ? c.citizenship : "ITALIA"}
            />
          </Field>
          <Field label="Codice fiscale"><Input name="taxCode" defaultValue={c?.taxCode ?? ""} maxLength={16} className="uppercase" /></Field>
          <Field label="Comune di residenza">
            <PlacePicker codeName="residenceCode" textName="residenceName" defaultCode={c?.residenceCode} defaultText={c?.residenceName} placeholder="Cerca comune o stato" />
          </Field>
          <Field label="Indirizzo di residenza" hint="Via e numero civico"><Input name="address" defaultValue={c?.address ?? ""} /></Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Documento e patente" sub="Servono per il contratto e per l'invio alla Polizia (CaRGOS)." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo di documento">
            <Select name="docTypeCode" defaultValue={c?.docTypeCode ?? "IDELE"}>
              <option value="">—</option>
              {CARGOS_DOC_TYPES.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Numero documento"><Input name="docNumber" defaultValue={c?.docNumber ?? ""} className="uppercase" /></Field>
          <Field label="Scadenza documento"><Input name="docExpiry" type="date" defaultValue={c?.docExpiry ?? ""} /></Field>
          <Field label="Documento rilasciato a" className="sm:col-span-2 lg:col-span-3">
            <PlacePicker codeName="docIssuedCode" textName="docIssuedBy" defaultCode={c?.docIssuedCode} defaultText={c?.docIssuedBy} placeholder="Comune o stato di rilascio" />
          </Field>
          <Field label="Numero patente"><Input name="licenseNumber" defaultValue={c?.licenseNumber ?? ""} className="uppercase" /></Field>
          <Field label="Scadenza patente"><Input name="licenseExpiry" type="date" defaultValue={c?.licenseExpiry ?? ""} /></Field>
          <Field label="Patente rilasciata a">
            <PlacePicker codeName="licenseIssuedCode" textName="licenseIssuedBy" defaultCode={c?.licenseIssuedCode} defaultText={c?.licenseIssuedBy} placeholder="Comune o stato" />
          </Field>
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
      <div className="sticky bottom-20 z-20 flex items-center gap-3 rounded-2xl bg-paper/90 p-3 ring-1 ring-line/70 backdrop-blur md:bottom-4">
        <Button type="submit" disabled={pending}>{pending ? "Salvataggio…" : submitLabel}</Button>
        {state.ok && !pending && <span className="text-sm font-semibold text-go">Salvato</span>}
        <div className="flex-1"><FormError message={state.error} /></div>
      </div>
    </form>
  );
}
