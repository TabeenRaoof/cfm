/**
 * RFC 4180 CSV writer. The mirror of the reader in @cfm/import, and dependency-free for the
 * same reasons.
 */

export interface WriteOptions {
  readonly delimiter?: string;
  /** Excel needs a BOM to read UTF-8 correctly, and sellers open these in Excel. */
  readonly bom?: boolean;
  /** \r\n is what every spreadsheet and marketplace importer expects. */
  readonly lineEnding?: string;
}

export function writeCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  options: WriteOptions = {},
): string {
  const delimiter = options.delimiter ?? ",";
  const lineEnding = options.lineEnding ?? "\r\n";
  const bom = options.bom === false ? "" : "﻿";

  const lines = [headers, ...rows].map((cells) =>
    cells.map((cell) => escapeCell(cell, delimiter)).join(delimiter),
  );
  return bom + lines.join(lineEnding) + lineEnding;
}

function escapeCell(value: string, delimiter: string): string {
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    // A leading or trailing space is silently trimmed by some importers otherwise.
    value !== value.trim();

  return needsQuoting ? `"${value.replace(/"/g, '""')}"` : value;
}
