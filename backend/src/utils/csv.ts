function escapeCsvField(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  // Neutralize formula injection in spreadsheet software
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}
