export type ExcelValue = string | number | boolean | Date | null | undefined;

export async function exportExcelFile({
  fileName,
  sheetName,
  headers,
  rows,
  widths,
}: {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: ExcelValue[][];
  widths?: number[];
}) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const headerRow = headers.map((value) => ({
    value,
    fontWeight: "bold" as const,
    backgroundColor: "EAF1FB",
    textColor: "1D3557",
    align: "center" as const,
  }));

  await writeExcelFile([headerRow, ...rows], {
    sheet: sheetName,
    columns: widths?.map((width) => ({ width })),
    stickyRowsCount: 1,
  }).toFile(fileName);
}
