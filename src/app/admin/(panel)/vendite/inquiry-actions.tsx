"use client";

import { useTransition } from "react";
import { setInquiryStatusAction } from "@/app/admin/actions/sales";

export function InquiryActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      {status === "new" && (
        <button
          disabled={pending}
          onClick={() => start(() => setInquiryStatusAction(id, "contacted"))}
          className="h-9 rounded-full bg-eu px-3.5 text-sm font-semibold text-white hover:bg-eu-deep disabled:opacity-50"
        >
          Segna come contattato
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => start(() => setInquiryStatusAction(id, "closed"))}
        className="h-9 rounded-full bg-paper px-3.5 text-sm font-semibold text-ink-2 ring-1 ring-line hover:ring-ink-3 disabled:opacity-50"
      >
        Archivia
      </button>
    </div>
  );
}
