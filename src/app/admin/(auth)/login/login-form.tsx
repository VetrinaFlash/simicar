"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions/auth";
import { Button, Field, FormError, Input, Panel } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <Panel className="p-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="username" required autoFocus inputMode="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormError message={state.error} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>
    </Panel>
  );
}
