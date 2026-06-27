import PDFDocument from "pdfkit";

type PdfValue = string | number | boolean | Date | null | undefined;

type PdfReportData = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: PdfValue[][];
};

function normalizePdfValue(value: PdfValue) {
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

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function drawTableHeader(params: {
  doc: PDFKit.PDFDocument;
  headers: string[];
  startX: number;
  startY: number;
  columnWidth: number;
  rowHeight: number;
}) {
  const { doc, headers, startX, startY, columnWidth, rowHeight } = params;

  doc.font("Helvetica-Bold").fontSize(7);

  headers.forEach((header, index) => {
    const x = startX + index * columnWidth;

    doc
      .rect(x, startY, columnWidth, rowHeight)
      .stroke();

    doc.text(truncateText(header, 18), x + 3, startY + 4, {
      width: columnWidth - 6,
      height: rowHeight - 4,
    });
  });
}

function drawTableRow(params: {
  doc: PDFKit.PDFDocument;
  row: PdfValue[];
  startX: number;
  startY: number;
  columnWidth: number;
  rowHeight: number;
}) {
  const { doc, row, startX, startY, columnWidth, rowHeight } = params;

  doc.font("Helvetica").fontSize(6);

  row.forEach((cell, index) => {
    const x = startX + index * columnWidth;
    const value = truncateText(normalizePdfValue(cell), 24);

    doc
      .rect(x, startY, columnWidth, rowHeight)
      .stroke();

    doc.text(value, x + 3, startY + 4, {
      width: columnWidth - 6,
      height: rowHeight - 4,
    });
  });
}

export async function buildPdfBuffer(data: PdfReportData) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const startX = 30;
    const tableWidth = pageWidth - 60;
    const columnWidth = tableWidth / data.headers.length;
    const rowHeight = 28;
    const headerY = 95;
    const bottomLimit = pageHeight - 45;

    function drawPageTitle() {
      doc.font("Helvetica-Bold").fontSize(16).text(data.title, 30, 30);

      doc.font("Helvetica").fontSize(9).text(
        data.subtitle ?? "Sistema de Gestión Integral — Industrias Aceros Perú",
        30,
        52,
      );

      doc.fontSize(8).text(
        `Generado: ${new Intl.DateTimeFormat("es-PE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())}`,
        30,
        68,
      );

      drawTableHeader({
        doc,
        headers: data.headers,
        startX,
        startY: headerY,
        columnWidth,
        rowHeight,
      });
    }

    drawPageTitle();

    let currentY = headerY + rowHeight;

    data.rows.forEach((row) => {
      if (currentY + rowHeight > bottomLimit) {
        doc.addPage();
        drawPageTitle();
        currentY = headerY + rowHeight;
      }

      drawTableRow({
        doc,
        row,
        startX,
        startY: currentY,
        columnWidth,
        rowHeight,
      });

      currentY += rowHeight;
    });

    const range = doc.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);

      doc.font("Helvetica").fontSize(8).text(
        `Página ${index + 1} de ${range.count}`,
        30,
        pageHeight - 30,
        {
          align: "right",
          width: pageWidth - 60,
        },
      );
    }

    doc.end();
  });
}

export function pdfResponse(content: Buffer, filename: string) {
  const arrayBuffer = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}