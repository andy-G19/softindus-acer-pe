"use client";

import Link from "next/link";

type ProductionErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ProductionErrorPage({
  error,
  reset,
}: ProductionErrorPageProps) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <section className="max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
          ⚠️
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Ocurrió un problema en Producción
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          El sistema no pudo completar la operación solicitada. Esto puede
          ocurrir por una validación, un dato relacionado que falta o una
          restricción del módulo.
        </p>

        <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-left text-sm text-slate-700">
          <p className="font-medium text-slate-900">Detalle técnico:</p>
          <p className="mt-1 wrap-break-word">{error.message}</p>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Intentar nuevamente
          </button>

          <Link
            href="/dashboard/production"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Volver a producción
          </Link>
        </div>
      </section>
    </main>
  );
}