/** Sagoma di riserva quando un veicolo non ha ancora foto. */
export function VehicleArt({ type, className }: { type: "auto" | "furgone"; className?: string }) {
  if (type === "furgone")
    return (
      <svg viewBox="0 0 240 120" className={className} aria-hidden>
        <path d="M18 88V34a10 10 0 0 1 10-10h118a10 10 0 0 1 9 6l14 28 34 8a14 14 0 0 1 11 14v8a4 4 0 0 1-4 4h-12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d="M18 88h22m40 0h88" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M152 32l14 28h-30V32z" fill="currentColor" opacity=".18" />
        <circle cx="60" cy="90" r="16" fill="none" stroke="currentColor" strokeWidth="5" />
        <circle cx="188" cy="90" r="16" fill="none" stroke="currentColor" strokeWidth="5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden>
      <path d="M22 86v-14a12 12 0 0 1 9-11l26-7 26-20a20 20 0 0 1 12-4h50a20 20 0 0 1 14 6l22 22 30 6a10 10 0 0 1 8 10v12a4 4 0 0 1-4 4h-10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M22 86h20m42 0h86" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M90 36h30v18H66zm38 0h22l18 18h-40z" fill="currentColor" opacity=".18" />
      <circle cx="63" cy="88" r="16" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="191" cy="88" r="16" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}
