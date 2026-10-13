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
      </div>

      <GalleryNote>
        El mensaje de error es hoy un párrafo suelto, copiado en 16 formularios y
        sin asociación accesible con su campo. El campo compartido con etiqueta,
        ayuda, obligatorio y error asociado llega en la sub-entrega de botones y
        campos. Teclado: en la búsqueda, las flechas recorren las opciones, Enter
        elige y Escape cierra.
      </GalleryNote>
    </GallerySection>
  );
}
