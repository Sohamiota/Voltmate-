import * as XLSX from 'xlsx';

/**
 * Convert an array of plain objects into an Excel (.xlsx) file and trigger a
 * browser download.  Each key of the first object becomes a column header.
 *
 * @param rows     Array of record objects (one per spreadsheet row).
 * @param filename Download filename — `.xlsx` is appended automatically if absent.
 * @param sheetName Optional worksheet tab name (default: "Sheet1").
 */
export function downloadXlsx(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1',
): void {
  if (rows.length === 0) {
    alert('No data to export.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const fname = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/** Helper: format a date-only string (YYYY-MM-DD) or ISO timestamp as a
 *  human-readable string for spreadsheet cells. */
export function xlsDate(d?: string | null): string {
  if (!d) return '';
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(`${plain}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Helper: format a full ISO timestamp for spreadsheet cells. */
export function xlsDateTime(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Parse a YYYY-MM-DD filter input as LOCAL midnight to avoid UTC-offset
 *  boundary issues when comparing date-only strings. */
export function parseLocalDate(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getTime();
}

/** Extract the date portion of an ISO string or YYYY-MM-DD as LOCAL midnight. */
export function parseRecordDate(d?: string | null): number {
  if (!d) return 0;
  const plain = d.length > 10 ? d.slice(0, 10) : d;
  return new Date(`${plain}T00:00:00`).getTime();
}
