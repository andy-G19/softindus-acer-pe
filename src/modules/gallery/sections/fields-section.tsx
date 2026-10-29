import { Field, FieldError } from "@/components/forms/field";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

const CLIENTES = [
  { id: "CLI00000001", label: "Metalmecánica Lima S.A.C.", description: "CLI00000001 - Empresa - 20123456789" },
  { id: "CLI00000002", label: "Taller Arequipa", description: "CLI00000002 - Persona natural" },
  { id: "CLI00000003", label: "Estructuras del Sur", description: "CLI00000003 - Empresa" },
];

export function FieldsSection() {
  return (
    <GallerySection
      id="campos"
      description="Campos de texto, listas, áreas de texto, interruptores y búsqueda, en sus estados. Nada de lo que se escribe aquí se envía."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <GallerySample label="Texto" className="block space-y-2">
          <Label htmlFor="galeria-nombre">Nombre o razón social</Label>
          <Input id="galeria-nombre" placeholder="Ej.: Metalmecánica Lima S.A.C." />
        </GallerySample>

        <GallerySample label="Con valor" className="block space-y-2">
          <Label htmlFor="galeria-documento">Número de documento</Label>
          <Input id="galeria-documento" defaultValue="20123456789" />
        </GallerySample>

        <GallerySample label="Deshabilitado" className="block space-y-2">
          <Label htmlFor="galeria-codigo">Código</Label>
          <Input id="galeria-codigo" defaultValue="CLI00000001" disabled />
        </GallerySample>

        <GallerySample label="Con error" className="block space-y-2">
          <Label htmlFor="galeria-correo">Correo</Label>
          <Input id="galeria-correo" defaultValue="ventas@" aria-invalid />
          <p className="text-sm text-destructive">Ingrese un correo válido.</p>
        </GallerySample>

        <GallerySample label="Fecha" className="block space-y-2">
          <Label htmlFor="galeria-fecha">Fecha de entrega</Label>
          <Input id="galeria-fecha" type="date" defaultValue="2026-10-13" />
        </GallerySample>

        <GallerySample label="Número" className="block space-y-2">
          <Label htmlFor="galeria-cantidad">Cantidad</Label>
          <Input id="galeria-cantidad" type="number" step="0.01" defaultValue="12.50" />
        </GallerySample>

        <GallerySample label="Lista" className="block space-y-2">
          <Label htmlFor="galeria-tipo">Tipo</Label>
          <NativeSelect id="galeria-tipo" defaultValue="">
            <option value="">Todos los tipos</option>
            <option value="empresa">Empresa</option>
            <option value="persona">Persona natural</option>
          </NativeSelect>
        </GallerySample>

        <GallerySample label="Lista deshabilitada" className="block space-y-2">
          <Label htmlFor="galeria-estado">Estado</Label>
          <NativeSelect id="galeria-estado" defaultValue="activo" disabled>
            <option value="activo">Activo</option>
          </NativeSelect>
        </GallerySample>

        <GallerySample label="Archivo" className="block space-y-2">
          <Label htmlFor="galeria-archivo">Adjunto</Label>
          <Input id="galeria-archivo" type="file" />
        </GallerySample>

        <GallerySample label="Área de texto" className="block space-y-2">
          <Label htmlFor="galeria-observaciones">Observaciones</Label>
          <Textarea id="galeria-observaciones" placeholder="Detalle adicional" />
        </GallerySample>

        <GallerySample label="Área de texto con error" className="block space-y-2">
          <Label htmlFor="galeria-motivo">Motivo de anulación</Label>
          <Textarea id="galeria-motivo" aria-invalid />
          <p className="text-sm text-destructive">El motivo es obligatorio.</p>
        </GallerySample>

        <GallerySample label="Interruptor">
          <Switch id="galeria-activo" defaultChecked aria-label="Activo" />
          <Switch id="galeria-inactivo" aria-label="Inactivo" />
          <Switch id="galeria-bloqueado" disabled aria-label="Deshabilitado" />
        </GallerySample>

        <GallerySample label="Búsqueda" className="block">
          <SearchableSelect
            name="galeria_cliente"
            label="Cliente"
            placeholder="Buscar cliente por nombre o código"
            items={CLIENTES}
            emptyMessage="No se encontraron clientes."
          />
        </GallerySample>

        <GallerySample label="Búsqueda con valor y obligatoria" className="block">
          <SearchableSelect
            name="galeria_cliente_obligatorio"
            label="Cliente"
            items={CLIENTES}
            value="CLI00000002"
            required
          />
        </GallerySample>

        <GallerySample label="Búsqueda deshabilitada" className="block">
          <SearchableSelect name="galeria_cliente_bloqueado" label="Cliente" items={CLIENTES} disabled />
        </GallerySample>

        <GallerySample label="Búsqueda con error" className="block">
          <div className="space-y-2">
            <SearchableSelect
              id="galeria_cliente_error"
              name="galeria_cliente_error"
              label="Cliente"
              items={CLIENTES}
              value="CLI00000003"
              required
              aria-invalid
              aria-describedby="galeria_cliente_error-error"
            />
            <FieldError
              id="galeria_cliente_error-error"
              messages={["El cliente seleccionado no existe o está inactivo."]}
            />
          </div>
        </GallerySample>
      </div>

      <GalleryNote>
        Campo completo (Field): une la etiqueta, la ayuda y el error con su
        control. El lector de pantalla anuncia el error y la ayuda al llegar al
        campo (aria-describedby), lo marca como inválido (aria-invalid) y dice
        «obligatorio» por el required; el asterisco es solo visual.
      </GalleryNote>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <GallerySample label="Campo con ayuda" className="block">
          <Field
            id="galeria-field-correo"
            label="Correo"
            description="Se usa para enviar la proforma."
          >
            {(control) => <Input {...control} type="email" placeholder="ventas@empresa.pe" />}
          </Field>
        </GallerySample>

        <GallerySample label="Campo obligatorio" className="block">
          <Field id="galeria-field-nombre" label="Nombre o razón social" required>
            {(control) => <Input {...control} placeholder="Ej.: Metalmecánica Lima S.A.C." />}
          </Field>
        </GallerySample>

        <GallerySample label="Campo con error" className="block">
          <Field
            id="galeria-field-ruc"
            label="RUC"
            description="11 dígitos."
            errors={["El RUC debe tener 11 dígitos."]}
            required
          >
            {(control) => <Input {...control} defaultValue="2012345" inputMode="numeric" />}
          </Field>
        </GallerySample>

        <GallerySample label="Lista con error" className="block">
          <Field id="galeria-field-tipo" label="Tipo de cliente" errors={["Seleccione un tipo de cliente."]} required>
            {(control) => (
              <NativeSelect {...control} defaultValue="">
                <option value="">Seleccione</option>
                <option value="empresa">Empresa</option>
                <option value="persona">Persona natural</option>
              </NativeSelect>
            )}
          </Field>
        </GallerySample>

        <GallerySample label="Área de texto con error" className="block">
          <Field
            id="galeria-field-motivo"
            label="Motivo de anulación"
            description="Queda registrado en la bitácora."
            errors={["El motivo es obligatorio."]}
            required
          >
            {(control) => <Textarea {...control} />}
          </Field>
        </GallerySample>

        <GallerySample label="Campo deshabilitado" className="block">
          <Field id="galeria-field-codigo" label="Código" description="No se envía con el formulario." disabled>
            {(control) => <Input {...control} defaultValue="CLI00000001" />}
          </Field>
        </GallerySample>

        <GallerySample label="Campo de solo lectura" className="block">
          <Field
            id="galeria-field-registro"
            label="Código de registro"
            description="Lo asigna el sistema; se puede copiar y se envía."
            readOnly
          >
            {(control) => <Input {...control} defaultValue="CLI00000001" />}
          </Field>
        </GallerySample>

        <GallerySample label="Lista de solo lectura" className="block">
          <Field
            id="galeria-field-rol"
            label="Rol"
            description="No puedes cambiar tu propio rol."
            readOnly
          >
            {(control) => (
              <>
                <Input {...control} defaultValue="Vendedor" />
                <input type="hidden" name="galeria_rol" value="SELLER" />
              </>
            )}
          </Field>
        </GallerySample>
      </div>

      <GalleryNote>
        Solo lectura y deshabilitado no son lo mismo: un campo de solo lectura se
        lee a contraste completo, recibe el foco, se puede copiar y se envía; uno
        deshabilitado se atenúa, se salta con Tab y no se envía. HTML no admite
        solo lectura en una lista: se muestra la opción elegida en un campo de
        solo lectura y su valor viaja en un input oculto. Las 16 copias locales
        del mensaje de error se reemplazan por FieldError en las entregas 9 y 10.
        Teclado: en la búsqueda, las flechas recorren las opciones, Enter elige y
        Escape cierra.
      </GalleryNote>
    </GallerySection>
  );
}
