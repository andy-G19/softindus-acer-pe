import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createSupplierAction } from "@/modules/inventory/suppliers/actions";

export default async function NewSupplierPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/access-denied");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">
          Inventario · Proveedores
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo proveedor</h1>
        <p className="text-slate-600">
          Registra los datos comerciales del proveedor para usarlo luego en
          compras y abastecimiento.
        </p>
      </section>

      <form action={createSupplierAction} className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Razón social *</label>
          <input
            name="razon_social"
            required
            placeholder="Ej. Aceros del Sur S.A.C."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de documento</label>
            <select
              name="tipo_documento"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Sin documento</option>
              <option value="ruc">RUC</option>
              <option value="dni">DNI</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Número de documento</label>
            <input
              name="numero_documento"
              placeholder="Ej. 20601234567"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              name="telefono"
              placeholder="Ej. 999 888 777"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Correo</label>
            <input
              name="correo"
              type="email"
              placeholder="proveedor@correo.com"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Dirección</label>
          <input
            name="direccion"
            placeholder="Dirección comercial"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Contacto principal</label>
            <input
              name="contacto_principal"
              placeholder="Nombre de la persona de contacto"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de proveedor *</label>
            <select
              name="tipo_proveedor"
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="materia_prima">Materia prima</option>
              <option value="consumibles">Consumibles</option>
              <option value="repuestos">Repuestos</option>
              <option value="servicios">Servicios</option>
              <option value="otros">Otros</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Condición de pago</label>
          <select
            name="condicion_pago"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">No especificado</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
            <option value="parcial">Parcial</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Observaciones</label>
          <textarea
            name="observaciones"
            rows={4}
            placeholder="Notas adicionales sobre el proveedor"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href="/dashboard/inventory/suppliers"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Guardar proveedor
          </button>
        </div>
      </form>
    </main>
  );
}