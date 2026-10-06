import "server-only";

import { registerAuditLog } from "@/lib/audit";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { getReportLabel } from "@/lib/reports/report-registry";

// Registro de cada archivo exportado: una fila en exportacion_datos y su
// entrada en la bitacora, en la misma transaccion.
export async function registerExportLog(data: {
  userId: string;
  report: string;
  filename: string;
  fileFormat: "excel" | "pdf";
  searchParams: URLSearchParams;
  totalExported: number;
}) {
  // Filtros resumidos para auditoria: nunca incluye fileFormat/limit (ruido)
  // ni puede contener datos sensibles, ya que estos parametros son siempre
  // filtros de negocio (fechas, estado, ids), nunca credenciales.
  const paramsObject = Object.fromEntries(data.searchParams.entries());

  delete paramsObject.fileFormat;
  delete paramsObject.limit;

  const label = getReportLabel(data.report);

  await prisma.$transaction(async (tx) => {
    const id_exportacion = await getNextCorrelativeId(tx, {
      codigoEntidad: "exportacion_datos",
      prefijo: "EXP",
    });

    await tx.exportacion_datos.create({
      data: {
        id_exportacion,
        id_usuario: data.userId,
        modulo_origen: label,
        formato: data.fileFormat,
        parametros: JSON.stringify(paramsObject),
        estado: "generada",
        ruta_archivo: data.filename,
      },
    });

    await registerAuditLog({
      userId: data.userId,
      entidad_afectada: "exportacion_datos",
      id_registro_afectado: id_exportacion,
      accion: "crear",
      detalle: `Reporte exportado: ${label} (${data.fileFormat}). Registros: ${data.totalExported}.`,
      tx,
    });
  });
}
