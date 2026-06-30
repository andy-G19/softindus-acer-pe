export function buildReportExportHref(
  report: string,
  params: Record<string, string>,
  fileFormat: "excel" | "pdf" = "excel",
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  searchParams.set("fileFormat", fileFormat);

  return `/api/reports/export/${report}?${searchParams.toString()}`;
}
