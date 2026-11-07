export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Caricamento">
      <div className="h-10 w-64 rounded-xl bg-concrete-2" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-paper ring-1 ring-line/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-paper ring-1 ring-line/60" />
    </div>
  );
}
