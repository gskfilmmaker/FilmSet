/**
 * A cell starting with =, +, -, @, tab, or CR is a formula trigger in
 * Excel/Sheets/LibreOffice — a name or note field containing one (typed or
 * pasted) would otherwise execute as a formula for whoever opens the
 * exported file. Prefixing with a leading apostrophe neutralizes it while
 * keeping the visible text unchanged.
 */
function escapeFormulaTrigger(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = escapeFormulaTrigger(value);
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
