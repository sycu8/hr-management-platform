/** Client-side table export for Excel-friendly CSV and SpreadsheetML (.xls). */

export type ExportCell = string | number | null | undefined | boolean

function cellText(value: ExportCell): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  return String(value)
}

function escapeCsv(value: ExportCell): string {
  const text = cellText(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function escapeXml(value: ExportCell): string {
  return cellText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** UTF-8 CSV with BOM so Excel on Windows opens Vietnamese correctly. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: ExportCell[][],
) {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ]
  const bom = '\uFEFF'
  downloadBlob(
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
    new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  )
}

/**
 * Excel 2003 SpreadsheetML (.xls) — opens in Excel / LibreOffice without
 * adding an xlsx dependency.
 */
export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExportCell[][],
) {
  const safeSheet = sheetName.replace(/[\\/*?[\]:]/g, '_').slice(0, 31) || 'Sheet1'
  const headerRow = `<Row>${headers
    .map(
      (h) =>
        `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`,
    )
    .join('')}</Row>`
  const dataRows = rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
          }
          return `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
        })
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(safeSheet)}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`

  downloadBlob(
    filename.endsWith('.xls') ? filename : `${filename}.xls`,
    new Blob([xml], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    }),
  )
}

export function downloadTable(
  format: 'csv' | 'excel',
  basename: string,
  sheetName: string,
  headers: string[],
  rows: ExportCell[][],
) {
  if (format === 'csv') downloadCsv(basename, headers, rows)
  else downloadExcel(basename, sheetName, headers, rows)
}
