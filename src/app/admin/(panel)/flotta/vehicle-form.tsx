"use client";

import { motion } from "motion/react";
import { useActionState, useEffect, useState } from "react";
import type { VehicleFormState } from "@/app/admin/actions/vehicles";
import { Button, Checkbox, Field, FormError, Input, Panel, PanelHeader, Select, Textarea, cx } from "@/components/ui";
import type { schema } from "@/lib/db/schema-types";

type Vehicle = typeof schema.vehicles.$inferSelect;

function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="relative grid h-11 grid-flow-col auto-cols-fr rounded-xl bg-concrete-2 p-1">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("relative rounded-[9px] text-[15px] font-semibold transition-colors", value === o.value ? "text-ink" : "text-ink-3")}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${name}`} className="absolute inset-0 rounded-[9px] bg-paper shadow-sm ring-1 ring-line/60" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function VehicleForm({
  vehicle,
  action,
  submitLabel,
}: {
  vehicle?: Vehicle;
  action: (prev: VehicleFormState, form: FormData) => Promise<VehicleFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<"auto" | "furgone">(vehicle?.type ?? "auto");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);
  const v = vehicle;
  const n = (x: number | null | undefined) => (x == null ? "" : String(x));

  return (
    <form action={formAction} className="space-y-5">
      <Panel>
        <PanelHeader title="Il veicolo" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Segmented
              name="type"
              value={type}
              onChange={setType}
              options={[
                { value: "auto", label: "Auto" },
                { value: "furgone", label: "Furgone" },
              ]}
            />
          </div>
          <Field label="Marca">
            <Input name="brand" defaultValue={v?.brand} required placeholder="Fiat" />
          </Field>
          <Field label="Modello">
            <Input name="model" defaultValue={v?.model} required placeholder={type === "furgone" ? "Ducato" : "Panda"} />
          </Field>
          <Field label="Versione" hint="Facoltativa, es. Maxi L3H2 o 1.0 Hybrid">
            <Input name="version" defaultValue={v?.version ?? ""} />
          </Field>
          <Field label="Anno">
            <Input name="year" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={n(v?.year)} />
          </Field>
          <Field label="Targa">
            <Input name="plate" defaultValue={v?.plate} required className="font-narrow uppercase tracking-wider" autoCapitalize="characters" />
          </Field>
          <Field label="Numero di telaio (VIN)" hint="Serve per la comunicazione alla Polizia (CaRGOS)">
            <Input name="vin" defaultValue={v?.vin ?? ""} maxLength={17} className="font-narrow uppercase tracking-wider" autoCapitalize="characters" />
          </Field>
          <Field label="Colore">
            <Input name="color" defaultValue={v?.color ?? ""} />
          </Field>
          <Field label="Chilometri attuali">
            <Input name="mileageKm" type="number" inputMode="numeric" min={0} defaultValue={n(v?.mileageKm)} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Caratteristiche" sub="Compaiono nella scheda sul sito." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Alimentazione">
            <Select name="fuel" defaultValue={v?.fuel ?? "diesel"}>
              <option value="benzina">Benzina</option>
              <option value="diesel">Diesel</option>
              <option value="ibrida">Ibrida</option>
              <option value="elettrica">Elettrica</option>
              <option value="gpl">GPL</option>
              <option value="metano">Metano</option>
            </Select>
          </Field>
          <Field label="Cambio">
            <Select name="transmission" defaultValue={v?.transmission ?? "manuale"}>
              <option value="manuale">Manuale</option>
              <option value="automatico">Automatico</option>
            </Select>
          </Field>
          <Field label="Posti">
            <Input name="seats" type="number" inputMode="numeric" min={1} max={60} defaultValue={n(v?.seats ?? (type === "furgone" ? 3 : 5))} />
          </Field>
          {type === "auto" ? (
            <>
              <Field label="Porte">
                <Input name="doors" type="number" inputMode="numeric" min={1} max={10} defaultValue={n(v?.doors ?? 5)} />
              </Field>
              <Field label="Valigie">
                <Input name="luggage" type="number" inputMode="numeric" min={0} max={20} defaultValue={n(v?.luggage)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Volume di carico (m³)">
                <Input name="cargoVolumeM3" type="number" inputMode="decimal" step="0.1" min={0} defaultValue={n(v?.cargoVolumeM3)} />
              </Field>
              <Field label="Portata (kg)">
                <Input name="payloadKg" type="number" inputMode="numeric" min={0} defaultValue={n(v?.payloadKg)} />
              </Field>
              <Field label="Lunghezza vano (cm)">
                <Input name="cargoLengthCm" type="number" inputMode="numeric" min={0} defaultValue={n(v?.cargoLengthCm)} />
              </Field>
            </>
          )}
          <Field label="Dotazioni" hint="Separate da virgola: aria condizionata, Bluetooth, sensori…" className="sm:col-span-2 lg:col-span-3">
            <Input name="features" defaultValue={v?.features?.join(", ") ?? ""} />
          </Field>
          <Field label="Descrizione" className="sm:col-span-2 lg:col-span-3">
            <Textarea name="description" defaultValue={v?.description ?? ""} rows={3} maxLength={2000} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Condizioni di noleggio" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Patente richiesta">
            <Select name="licenseRequired" defaultValue={v?.licenseRequired ?? "B"}>
              <option value="B">B</option>
              <option value="B96">B96</option>
              <option value="BE">BE</option>
              <option value="C1">C1</option>
              <option value="C">C</option>
            </Select>
          </Field>
          <Field label="Età minima">
            <Input name="minDriverAge" type="number" inputMode="numeric" min={18} max={99} defaultValue={n(v?.minDriverAge)} />
          </Field>
          <Field label="Cauzione (€)">
            <Input name="depositEur" type="number" inputMode="numeric" min={0} defaultValue={n(v?.depositEur)} />
          </Field>
          <Field label="Prezzo «da» (€/giorno)" hint="Facoltativo. Se vuoto, sul sito non compare.">
            <Input name="priceFromEur" type="number" inputMode="numeric" min={0} defaultValue={n(v?.priceFromEur)} />
          </Field>
          <Field label="Stato">
            <Select name="status" defaultValue={v?.status ?? "available"}>
              <option value="available">Disponibile</option>
              <option value="maintenance">In officina</option>
              <option value="inactive">Non attivo</option>
            </Select>
          </Field>
          <div className="flex items-end pb-2.5 sm:col-span-1 lg:col-span-3">
            <Checkbox name="isPublic" defaultChecked={v?.isPublic ?? true} label="Mostra sul sito e accetta richieste online" />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Scadenze" sub="Ricevi un avviso 30 giorni prima." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Assicurazione">
            <Input name="insuranceExpiry" type="date" defaultValue={v?.insuranceExpiry ?? ""} />
          </Field>
          <Field label="Revisione">
            <Input name="revisionExpiry" type="date" defaultValue={v?.revisionExpiry ?? ""} />
          </Field>
          <Field label="Bollo">
            <Input name="taxExpiry" type="date" defaultValue={v?.taxExpiry ?? ""} />
          </Field>
          <Field label="Tagliando (data)">
            <Input name="serviceDueDate" type="date" defaultValue={v?.serviceDueDate ?? ""} />
          </Field>
          <Field label="Tagliando (km)">
            <Input name="serviceDueKm" type="number" inputMode="numeric" min={0} defaultValue={n(v?.serviceDueKm)} />
          </Field>
        </div>
      </Panel>

      <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-2xl bg-paper/90 p-3 ring-1 ring-line/70 backdrop-blur md:bottom-4">
        <div className="mr-auto min-w-0 flex-1">
          <FormError message={state.error} />
          {saved && <p className="px-2 text-sm font-semibold text-go">Modifiche salvate</p>}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
