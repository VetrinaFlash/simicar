import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
const btn: Record<BtnVariant, string> = {
  primary: "bg-eu text-white hover:bg-eu-deep",
  secondary: "bg-paper text-ink ring-1 ring-line hover:ring-ink-3",
  ghost: "text-ink-2 hover:bg-concrete-2 hover:text-ink",
  danger: "bg-paper text-stop ring-1 ring-stop/30 hover:bg-stop-soft",
  success: "bg-go text-white hover:brightness-110",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 text-[15px] font-semibold transition-[background,box-shadow,transform,filter] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={clsx(btnBase, btn[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={clsx(btnBase, btn[variant], className)} {...props} />;
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={clsx("rounded-2xl bg-paper ring-1 ring-line/70", className)} {...props} />;
}

export function PanelHeader({ title, action, sub }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-stop">{error}</span>}
    </label>
  );
}

const inputCls =
  "block w-full h-11 rounded-xl bg-paper px-3.5 text-[15px] text-ink ring-1 ring-line placeholder:text-ink-3 transition-shadow focus:outline-none focus:ring-2 focus:ring-eu";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputCls, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(inputCls, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d8593' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputCls, "h-auto min-h-24 py-2.5", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-3 text-[15px]", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-eu" {...props} />
      <span>{label}</span>
    </label>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Da confermare", cls: "bg-signal-soft text-[#7a5a00] ring-signal/60" },
  confirmed: { label: "Confermata", cls: "bg-eu-soft text-eu ring-eu/25" },
  completed: { label: "Conclusa", cls: "bg-go-soft text-go ring-go/25" },
  rejected: { label: "Rifiutata", cls: "bg-stop-soft text-stop ring-stop/25" },
  cancelled: { label: "Annullata", cls: "bg-concrete-2 text-ink-2 ring-line" },
  block: { label: "Blocco", cls: "bg-concrete-2 text-ink-2 ring-line" },
};

export function StatusBadge({ status, kind }: { status: string; kind?: string }) {
  const s = kind === "block" && status === "confirmed" ? STATUS.block! : (STATUS[status] ?? STATUS.cancelled!);
  return (
    <span className={clsx("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset", s.cls)}>
      {s.label}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "danger" | "ok" }) {
  const cls = {
    neutral: "bg-concrete-2 text-ink-2",
    warn: "bg-signal-soft text-[#7a5a00]",
    danger: "bg-stop-soft text-stop",
    ok: "bg-go-soft text-go",
  }[tone];
  return <span className={clsx("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", cls)}>{children}</span>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-[17px] font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-wide text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-stop-soft px-4 py-3 text-sm font-medium text-stop">
      {message}
    </p>
  );
}

export function eur(n: number | null | undefined) {
  if (n == null) return "—";
  return `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
