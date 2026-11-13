import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createPettyCashBoxAction } from "@/modules/petty-cash/boxes/actions";
import { PettyCashBoxForm } from "@/modules/petty-cash/boxes/box-form";
import { pettyCashNotifications } from "@/modules/petty-cash/notifications";

type NewPettyCashBoxPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function NewPettyCashBoxPage({ searchParams }: NewPettyCashBoxPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  // C7 de la 11.4a (D46): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // listado de cajas, como antes.
  const backHref = getSafeReturnTo((await searchParams)?.returnTo, navigationHrefs.pettyCashBoxes);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abrir caja chica"
        description="Registra una nueva caja chica indicando nombre, saldo inicial, fecha de apertura, responsable y observaciones."
        backHref={backHref}
        backLabel="Volver a cajas"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Cajas", href: navigationHrefs.pettyCashBoxes },
          { label: "Nueva caja" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de apertura</CardTitle>
          </CardHeader>

          <CardContent>
            <PettyCashBoxForm
              action={createPettyCashBoxAction}
              defaultDate={today}
              successNotification={pettyCashNotifications["petty-cash-box-created"]}
              returnTo={backHref}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recomendación</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Usa una caja principal para los gastos menores diarios del
              taller.
            </p>

            <p>
              El saldo inicial será también el saldo actual al momento de
              crear la caja.
            </p>

            <p>
              Más adelante, los ingresos y egresos modificarán
              automáticamente el saldo actual.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
