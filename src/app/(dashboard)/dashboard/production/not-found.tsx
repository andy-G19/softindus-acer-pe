import Link from "next/link";

export default function ProductionNotFoundPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <section className="max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
          🔎
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Registro de producción no encontrado
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          El registro solicitado no existe, fue eliminado o el código usado no
          corresponde a un recurso válido del módulo de producción.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard/production"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Ir al módulo Producción
          </Link>

          <Link
            href="/dashboard/production/work-orders"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver órdenes de trabajo
          </Link>
        </div>
      </section>
    </main>
  );
}