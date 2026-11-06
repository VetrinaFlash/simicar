"use client";

import { useTransition, type ReactNode } from "react";
import { Button } from "./ui";

export function ConfirmButton({
  action,
  message,
  children,
  variant = "secondary",
  className,
}: {
  action: () => Promise<unknown>;
  message: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm(message)) start(async () => void (await action()));
      }}
    >
      {pending ? "Attendi…" : children}
    </Button>
  );
}
