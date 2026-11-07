export default function Loading() {
  return (
    <main className="pb-24 pt-24 md:pt-28" aria-busy="true" aria-label="Caricamento">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 md:px-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-pulse">
          <div className="mt-10 h-4 w-20 rounded bg-concrete-2" />
          <div className="mt-3 h-16 w-3/4 rounded-xl bg-concrete-2" />
          <div className="mt-8 aspect-[16/10] rounded-[24px] bg-concrete-2" />
        </div>
        <div className="mt-10 h-[520px] animate-pulse rounded-[20px] bg-concrete-2" />
      </div>
    </main>
  );
}
