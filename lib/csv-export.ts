type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => unknown;
};

function escapeCsvValue(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(","),
  );

  return `\uFEFF${[header, ...dataRows].join("\r\n")}\r\n`;
}
