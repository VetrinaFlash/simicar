"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { VehicleArt } from "@/components/vehicle-art";
import { cx } from "@/components/ui";

type Photo = { src: string; width: number | null; height: number | null };

export function Gallery({ photos, name, type }: { photos: Photo[]; name: string; type: "auto" | "furgone" }) {
  const [i, setI] = useState(0);
  if (photos.length === 0)
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-[24px] bg-concrete-2">
        <VehicleArt type={type} className="w-1/2 text-ink-3" />
      </div>
    );
  const cur = photos[i]!;
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-concrete-2">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={cur.src}
            src={cur.src}
            alt={`${name}, foto ${i + 1} di ${photos.length}`}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 size-full object-cover"
            drag={photos.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) setI((x) => (x + 1) % photos.length);
              if (info.offset.x > 60) setI((x) => (x - 1 + photos.length) % photos.length);
            }}
          />
        </AnimatePresence>
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, k) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setI(k)}
              aria-label={`Foto ${k + 1}`}
              aria-current={k === i}
              className={cx("relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl transition-opacity", k === i ? "ring-2 ring-eu ring-offset-2 ring-offset-concrete" : "opacity-60 hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
