/** RFC 4180 CSV. Cells starting with = + - @ are prefixed so spreadsheets never run them as formulas. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return rows
    .map((row) =>
      row
        .map((raw) => {
          const value = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    )
    .join('\r\n');
}

export function downloadText(text: string, fileName: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
