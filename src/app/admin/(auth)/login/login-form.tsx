"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions/auth";
import { Button, Field, FormError, Input, Panel } from "@/components/ui";

export function LoginForm({ next, configured }: { next?: string; configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <Panel className="p-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Username">
          <Input name="username" type="text" autoComplete="username" required autoFocus />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormError message={configured ? state.error : "Il Secret ADMIN_PASSWORD non è disponibile nel Worker. Aggiungilo in Cloudflare → Workers & Pages → simicar → Settings → Variables and Secrets (non nelle sole impostazioni di build), quindi pubblica una nuova versione."} />
        <Button type="submit" className="w-full" disabled={pending || !configured}>
          {pending ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>
    </Panel>
  );
}
