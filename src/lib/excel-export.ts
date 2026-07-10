import ExcelJS from "exceljs";

export type ExcelValue = string | number | boolean | Date | null | undefined;

type ExcelReportData = {
  title: string;
  /**
   * Linea informativa opcional bajo el titulo: fecha de generacion, filtros
   * aplicados, total exportado y limite aplicado. Se agrega como una fila
   * extra simple (no una hoja separada) para no complicar el archivo.
   */
  metadata?: string;
  headers: string[];
  rows: ExcelValue[][];
};

function normalizeExcelValue(value: ExcelValue) {
  if (value === null || value === undefined) {
    return "";
  }

  return value;
}

function getColumnWidth(header: string, rows: ExcelValue[][], index: number) {
  const contentLengths = rows.map((row) => {
    const value = normalizeExcelValue(row[index]);

    if (value instanceof Date) {
      return 12;
    }

    return String(value).length;
  });

  return Math.min(Math.max(header.length, ...contentLengths, 12) + 2, 60);
}

export async function buildExcelBuffer(data: ExcelReportData) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "SoftIndus Aceros Peru";
  workbook.created = new Date();
  workbook.modified = new Date();

  const metadataRowCount = data.metadata ? 1 : 0;
  const headerRowNumber = 2 + metadataRowCount;

  const worksheet = workbook.addWorksheet("Reporte", {
    views: [{ state: "frozen", ySplit: headerRowNumber }],
  });

  worksheet.addRow([data.title]);
  worksheet.mergeCells(1, 1, 1, Math.max(data.headers.length, 1));

  const titleCell = worksheet.getCell(1, 1);
  titleCell.font = {
    bold: true,
    size: 16,
  };
  titleCell.alignment = {
    vertical: "middle",
  };

  if (data.metadata) {
    worksheet.addRow([data.metadata]);
    worksheet.mergeCells(2, 1, 2, Math.max(data.headers.length, 1));

    const metadataCell = worksheet.getCell(2, 1);
    metadataCell.font = {
      italic: true,
      size: 9,
      color: { argb: "FF6B7280" },
    };
    metadataCell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
  }

  const headerRow = worksheet.addRow(data.headers);

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    cell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  data.rows.forEach((row) => {
    worksheet.addRow(row.map(normalizeExcelValue));
  });

  data.headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = getColumnWidth(
      header,
      data.rows,
      index,
    );
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) {
      return;
    }

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        wrapText: true,
      };
    });
  });

  const content = await workbook.xlsx.writeBuffer();

  return Buffer.from(content);
}

export function excelResponse(content: Buffer, filename: string) {
  const arrayBuffer = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
