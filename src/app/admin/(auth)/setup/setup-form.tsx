"use client";

import { useActionState } from "react";
import { setupAction, type SetupState } from "@/app/admin/actions/setup";
import { Button, Field, FormError, Input, Panel } from "@/components/ui";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupAction, {});
  return (
    <Panel className="p-6">
      <form action={action} className="space-y-4">
        <Field label="Codice di attivazione" hint="Il valore ADMIN_SETUP_TOKEN impostato su Cloudflare">
          <Input name="token" type="password" required autoComplete="off" />
        </Field>
        <Field label="Il tuo nome"><Input name="name" required autoComplete="name" /></Field>
        <Field label="Email"><Input name="email" type="email" required autoComplete="username" /></Field>
        <Field label="Password" hint="Almeno 12 caratteri"><Input name="password" type="password" minLength={12} required autoComplete="new-password" /></Field>
        <Field label="Ripeti la password"><Input name="confirm" type="password" required autoComplete="new-password" /></Field>
        <FormError message={state.error} />
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Attivazione…" : "Crea account e accedi"}</Button>
      </form>
    </Panel>
  );
}
