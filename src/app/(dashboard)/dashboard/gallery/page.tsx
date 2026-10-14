import { Info } from "lucide-react";

import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { GalleryToc } from "@/modules/gallery/gallery-layout";
import { ButtonsSection } from "@/modules/gallery/sections/buttons-section";
import { FieldsSection } from "@/modules/gallery/sections/fields-section";
import { FoundationsSection } from "@/modules/gallery/sections/foundations-section";
import { ListingSection } from "@/modules/gallery/sections/listing-section";
import { MessagesSection } from "@/modules/gallery/sections/messages-section";
import { PresentationSection } from "@/modules/gallery/sections/presentation-section";
import { WindowsSection } from "@/modules/gallery/sections/windows-section";

// Galeria de componentes (entrega 8): catalogo interno de la base visual, solo
// para ADMIN y fuera del menu. Usa datos ficticios: no consulta la base, no
// ejecuta acciones del servidor y no enlaza a rutas de /api/.
export default async function GalleryPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Galería de componentes"
        description="Catálogo interno de la base visual del ERP: cada componente compartido con sus estados, para revisarlos en escritorio, móvil y teclado antes de usarlos en las pantallas."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Galería de componentes" }])}
      />

      <Alert variant="info">
        <Info />
        <AlertTitle>Datos de ejemplo</AlertTitle>
        <AlertDescription>
          Todo lo que aparece aquí es ficticio: ningún botón ni formulario de esta
          página guarda información.
        </AlertDescription>
      </Alert>

      <GalleryToc />

      <FoundationsSection />
      <ButtonsSection />
      <FieldsSection />
      <MessagesSection />
      <WindowsSection />
      <PresentationSection />
      <ListingSection />
    </div>
  );
}
