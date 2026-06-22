import Link from "next/link";

export default function CommercialPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Módulo Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de clientes, productos, pedidos, proformas, pagos y comprobantes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/commercial/clients"
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h2 className="font-semibold">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Registrar y consultar clientes del taller.
          </p>
        </Link>

        <Link
          href="/dashboard/commercial/products"
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h2 className="font-semibold">Productos</h2>
          <p className="text-sm text-muted-foreground">
            Registrar y consultar productos comerciales o fabricados.
          </p>
        </Link>

        <Link
          href="/dashboard/commercial/orders"
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h2 className="font-semibold">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Registrar pedidos de clientes y su detalle comercial.
          </p>
        </Link>
      </div>
    </main>
  );
}