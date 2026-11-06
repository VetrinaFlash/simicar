import clsx from "clsx";

/** Targa in stile europeo (banda blu con "I"). Solo nel pannello: le targhe non vanno sul sito pubblico. */
export function Plate({ value, size = "md", className }: { value: string; size?: "sm" | "md"; className?: string }) {
  const pretty = value.length === 7 ? `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5)}` : value;
  return (
    <span
      className={clsx(
        "inline-flex items-stretch overflow-hidden rounded-[5px] bg-white font-narrow font-bold uppercase leading-none text-ink ring-1 ring-ink/25",
        size === "sm" ? "h-6 text-[13px]" : "h-8 text-[17px]",
        className,
      )}
    >
      <span className={clsx("flex flex-col items-center justify-end bg-eu text-white", size === "sm" ? "w-3.5 pb-0.5 text-[7px]" : "w-5 pb-1 text-[9px]")}>
        I
      </span>
      <span className={clsx("flex items-center tracking-[0.06em] tabular", size === "sm" ? "px-1.5" : "px-2.5")}>{pretty}</span>
    </span>
  );
}
