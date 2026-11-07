import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5">
      <div className="max-w-md text-center">
        <p className="font-narrow text-[120px] font-black leading-none text-red">404</p>
        <h1 className="font-narrow mt-2 text-4xl font-black uppercase text-eu-deep">Strada sbagliata</h1>
        <p className="mt-3 text-[17px] text-ink-2">La pagina che cerchi non esiste o il mezzo non è più disponibile.</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-xl bg-red px-6 text-[16px] font-bold text-white hover:bg-red-deep">
          Torna alla flotta
        </Link>
      </div>
    </main>
  );
}
