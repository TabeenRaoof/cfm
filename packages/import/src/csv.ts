/**
 * RFC 4180 CSV reader.
 *
 * Hand-written rather than a dependency, for the same reason the catalog is dependency-free:
 * this runs in the public scanner path, which must stay cheap, auditable and free of anything
 * that could reach the network. It is about eighty lines and fully tested; a parser library
 * would be more code, not less, once its configuration is counted.
 */

export interface ParsedCsv {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface CsvOptions {
  /** Hard cap. The scanner is unauthenticated, so the input size is an attacker's choice. */
  readonly maxRows: number;
  readonly delimiter?: string;
}

export class CsvTooLargeError extends Error {
  readonly maxRows: number;

  constructor(maxRows: number) {
    super(`This file has more than ${maxRows} rows.`);
    this.name = "CsvTooLargeError";
    this.maxRows = maxRows;
  }
}

export function parseCsv(text: string, options: CsvOptions): ParsedCsv {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const records = readRecords(stripBom(text), delimiter, options.maxRows);

  const [headerRecord, ...rows] = records;
  if (!headerRecord) return { headers: [], rows: [] };

  return { headers: headerRecord.map((h) => h.trim()), rows };
}

/**
 * Exports from European sellers are frequently semicolon-separated, because that is what a
 * German or French Excel produces. Guessing from the header line is more reliable than asking
 * the user, who generally does not know.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ",";
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readRecords(text: string, delimiter: string, maxRows: number): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let sawAnyCharacter = false;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    // A trailing newline produces one empty field; that is not a record.
    if (!(record.length === 1 && record[0] === "")) records.push(record);
    record = [];
    // maxRows counts data rows, so the header is allowed through before the cap bites.
    if (records.length > maxRows + 1) throw new CsvTooLargeError(maxRows);
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    sawAnyCharacter = true;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n") {
      endRecord();
    } else if (char === "\r") {
      // Swallow; the \n that follows ends the record. A lone \r is treated as a line end too.
      if (text[i + 1] !== "\n") endRecord();
    } else {
      field += char;
    }
  }

  if (sawAnyCharacter && (field !== "" || record.length > 0)) endRecord();
  return records;
}
