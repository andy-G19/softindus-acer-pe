import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toggleClientStatusAction } from "@/modules/commercial/clients/actions";

export default async function ClientsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const clients = await prisma.cliente.findMany({
    orderBy: {
      fecha_registro: "desc",
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Lista de clientes registrados en el sistema.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/clients/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Nuevo cliente
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Origen</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id_cliente} className="border-t">
                <td className="px-4 py-3">{client.id_cliente}</td>
                <td className="px-4 py-3">{client.nombre_razon_social}</td>
                <td className="px-4 py-3">{client.tipo_cliente}</td>
                <td className="px-4 py-3">{client.telefono ?? "-"}</td>
                <td className="px-4 py-3">{client.lugar_origen ?? "-"}</td>
                <td className="px-4 py-3">
                  {client.estado ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/commercial/clients/${client.id_cliente}/edit`}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Editar
                    </Link>

                    <form action={toggleClientStatusAction}>
                      <input
                        type="hidden"
                        name="id_cliente"
                        value={client.id_cliente}
                      />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      >
                        {client.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay clientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
