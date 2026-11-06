"use client";

import { Check, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./ui";

type Place = { code: number; name: string; province: string | null; kind: "comune" | "stato" };

const label = (p: Place) => (p.kind === "stato" ? p.name : `${p.name}${p.province ? ` (${p.province})` : ""}`);

/**
 * Campo con ricerca nella tabella luoghi CaRGOS. Salva sia il nome leggibile
 * (textName) sia il codice ufficiale della Polizia (codeName).
 */
export function PlacePicker({
  codeName,
  textName,
  defaultCode,
  defaultText,
  kind,
  placeholder,
}: {
  codeName: string;
  textName: string;
  defaultCode?: number | null;
  defaultText?: string | null;
  kind?: "comune" | "stato";
  placeholder?: string;
}) {
  const [text, setText] = useState(defaultText ?? "");
  const [code, setCode] = useState<number | null>(defaultCode ?? null);
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function search(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/places?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ""}`);
      if (res.ok) {
        const data = (await res.json()) as { items: Place[] };
        setItems(data.items);
        setActive(0);
        setOpen(true);
      }
    }, 180);
  }

  function choose(p: Place) {
    setText(label(p));
    setCode(p.code);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={codeName} value={code ?? ""} />
      <input type="hidden" name={textName} value={text} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          placeholder={placeholder ?? (kind === "stato" ? "Cerca lo stato" : "Cerca il comune")}
          onChange={(e) => {
            setText(e.target.value);
            setCode(null);
            search(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className={cx(
            "block h-11 w-full rounded-xl bg-paper pl-10 pr-10 text-[15px] text-ink ring-1 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-eu",
            text && !code ? "ring-signal" : "ring-line",
          )}
        />
        {code && <Check className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-go" aria-label="Codice CaRGOS associato" />}
      </div>
      {text && !code && !open && <p className="mt-1 text-xs text-[#7a5a00]">Scegli dall&apos;elenco per collegare il codice ufficiale.</p>}
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl bg-paper py-1 shadow-xl ring-1 ring-line">
          {items.map((p, i) => (
            <li key={p.code} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                onMouseEnter={() => setActive(i)}
                className={cx("flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[15px]", i === active && "bg-eu-soft")}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-ink-3">{p.kind === "stato" ? "Stato" : p.province}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
