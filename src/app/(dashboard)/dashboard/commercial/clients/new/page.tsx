import { createClientAction } from "@/modules/commercial/clients/actions";

export default function NewClientPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Registra los datos comerciales del cliente.
        </p>
      </div>

      <form action={createClientAction} className="space-y-4 rounded-lg border p-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de cliente</label>
          <select name="tipo_cliente" className="w-full rounded-md border px-3 py-2" required>
            <option value="cliente_final">Cliente final</option>
            <option value="ferreteria">Ferretería</option>
            <option value="distribuidora">Distribuidora</option>
            <option value="constructora">Constructora</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre o razón social</label>
          <input
            name="nombre_razon_social"
            className="w-full rounded-md border px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de documento</label>
            <select name="tipo_documento" className="w-full rounded-md border px-3 py-2">
              <option value="">Sin documento</option>
              <option value="dni">DNI</option>
              <option value="ruc">RUC</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Número de documento</label>
            <input name="numero_documento" className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Teléfono</label>
            <input name="telefono" className="w-full rounded-md border px-3 py-2" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Correo</label>
            <input type="email" name="correo" className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Dirección</label>
          <input name="direccion" className="w-full rounded-md border px-3 py-2" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Lugar de origen</label>
          <input name="lugar_origen" className="w-full rounded-md border px-3 py-2" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Observaciones</label>
          <textarea name="observaciones" className="w-full rounded-md border px-3 py-2" />
        </div>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Guardar cliente
        </button>
      </form>
    </main>
  );
}