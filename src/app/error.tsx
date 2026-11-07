"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5">
      <div className="max-w-md text-center">
        <h1 className="font-narrow text-4xl font-black uppercase text-eu-deep">Qualcosa è andato storto</h1>
        <p className="mt-3 text-[17px] text-ink-2">Riprova tra qualche secondo. Se il problema continua, chiamaci.</p>
        <button onClick={reset} className="mt-8 inline-flex h-12 items-center rounded-xl bg-red px-6 text-[16px] font-bold text-white hover:bg-red-deep">
          Riprova
        </button>
      </div>
    </main>
  );
}
