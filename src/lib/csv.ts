// Shared CSV export helpers.
//
// Every cell is quoted, and cells beginning with = + - @ (or a tab/return)
// get a leading apostrophe so spreadsheet apps show them as text instead of
// running them as formulas (a name like "=HYPERLINK(...)" can't do anything).
export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** A safe file name from any text, e.g. an event title. */
export function fileSlug(text: string, max = 40): string {
  return (text || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, max).replace(/(^-+|-+$)/g, '') || 'export';
}

export function downloadCsv(fileName: string, rows: unknown[][]): void {
  // A byte-order mark so Excel opens names with accents correctly.
  const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
