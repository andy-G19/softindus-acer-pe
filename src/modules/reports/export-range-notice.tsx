import { MAX_DATE_RANGE_DAYS } from "@/lib/reports/export-limits";

// Ocupa el lugar de los botones de exportar cuando el rango supera lo que
// admite la exportacion (entrega 10.2): la pantalla sigue mostrando los datos,
// y la ruta rechazaria el archivo con un 400.
export function ExportRangeNotice() {
  return (
    <p className="text-sm text-muted-foreground">
      {`Para exportar, el rango no puede superar ${MAX_DATE_RANGE_DAYS} días.`}
    </p>
  );
}
