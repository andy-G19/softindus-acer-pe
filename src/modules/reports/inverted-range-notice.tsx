import { Alert, AlertDescription } from "@/components/ui/alert";

// Aviso de una pantalla de reporte con el rango de fechas invertido (entrega
// 10.2): ocupa el lugar de los totales y las tablas, que no se consultan, y la
// pantalla no ofrece exportar.
export function InvertedRangeNotice() {
  return (
    <Alert variant="warning">
      <AlertDescription>Corrige el rango de fechas para ver el reporte.</AlertDescription>
    </Alert>
  );
}
