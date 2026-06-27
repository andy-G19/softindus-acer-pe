type CsvValue = string | number | boolean | Date | null | undefined;

function normalizeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }

  return String(value);
}

function escapeCsvCell(value: CsvValue) {
  const normalized = normalizeCsvValue(value);
  const escaped = normalized.replaceAll('"', '""');

  return `"${escaped}"`;
}

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  const csvRows = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return `\uFEFF${csvRows.join("\r\n")}`;
}

export function csvResponse(content: string, filename: string) {
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}