export default function ProductionLoadingPage() {
  return (
    <main className="space-y-6">
      <section>
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-80 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-200" />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </section>
    </main>
  );
}