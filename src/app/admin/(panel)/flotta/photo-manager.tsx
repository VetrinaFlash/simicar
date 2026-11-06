"use client";

import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deletePhotoAction, setCoverPhotoAction } from "@/app/admin/actions/vehicles";
import { Panel, PanelHeader, cx } from "@/components/ui";
import { mediaUrl } from "@/lib/vehicles";

type Photo = { id: string; r2Key: string };

/** Ridimensiona nel browser (max 1920px, WebP): upload veloci anche da telefono in 4G. */
async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return { blob, width, height };
  // Safari vecchi non esportano WebP: ripiego su JPEG
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!jpeg) throw new Error("Impossibile elaborare la foto");
  return { blob: jpeg, width, height };
}

export function PhotoManager({ vehicleId, photos }: { vehicleId: string; photos: Photo[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, startTransition] = useTransition();

  async function upload(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setUploading(list.length);
    for (const file of list) {
      try {
        const { blob, width, height } = await resize(file);
        const fd = new FormData();
        fd.append("file", blob, "photo");
        fd.append("width", String(width));
        fd.append("height", String(height));
        const res = await fetch(`/api/admin/vehicles/${vehicleId}/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Caricamento non riuscito.");
        }
      } catch {
        setError("Non è stato possibile leggere una delle foto.");
      }
      setUploading((n) => n - 1);
    }
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader title="Foto" sub="La prima foto è la copertina sul sito. Puoi scattarle direttamente dal telefono." />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {photos.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-concrete-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(p.r2Key)} alt="" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-signal px-2 py-0.5 text-[11px] font-bold text-ink">Copertina</span>
                )}
                <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                  {i > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startTransition(() => setCoverPhotoAction(p.id))}
                      className="grid size-9 place-items-center rounded-full bg-paper/95 text-ink shadow"
                      aria-label="Usa come copertina"
                      title="Usa come copertina"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Eliminare questa foto?")) startTransition(() => deletePhotoAction(p.id));
                    }}
                    className="grid size-9 place-items-center rounded-full bg-paper/95 text-stop shadow"
                    aria-label="Elimina foto"
                    title="Elimina foto"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            className={cx(
              "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors",
              dragging ? "border-eu bg-eu-soft text-eu" : "border-line text-ink-3 hover:border-ink-3 hover:text-ink-2",
            )}
          >
            {uploading > 0 ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {uploading > 0 ? `Caricamento (${uploading})…` : "Aggiungi foto"}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
        {error && <p className="mt-3 text-sm font-medium text-stop">{error}</p>}
      </div>
    </Panel>
  );
}
