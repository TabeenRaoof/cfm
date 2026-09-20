import { describe, expect, it } from "vitest";
import { CsvTooLargeError, parseCsv } from "../src/csv.ts";

const parse = (text: string, maxRows = 1000) => parseCsv(text, { maxRows });

describe("parseCsv", () => {
  it("reads headers and rows", () => {
    const { headers, rows } = parse("sku,title\nA1,Widget\nA2,Gadget\n");
    expect(headers).toEqual(["sku", "title"]);
    expect(rows).toEqual([["A1", "Widget"], ["A2", "Gadget"]]);
  });

  it("keeps delimiters and newlines inside quoted fields", () => {
    const { rows } = parse('sku,title\nA1,"Widget, large\nwith a second line"\n');
    expect(rows[0]?.[1]).toBe("Widget, large\nwith a second line");
  });

  it("unescapes doubled quotes", () => {
    const { rows } = parse('sku,title\nA1,"He said ""hello"""\n');
    expect(rows[0]?.[1]).toBe('He said "hello"');
  });

  it("handles CRLF line endings", () => {
    const { rows } = parse("sku,title\r\nA1,Widget\r\n");
    expect(rows).toEqual([["A1", "Widget"]]);
  });

  it("strips a byte-order mark, which Excel adds", () => {
    const { headers } = parse("﻿sku,title\nA1,Widget\n");
    expect(headers[0]).toBe("sku");
  });

  it("detects semicolons, which a German or French Excel produces", () => {
    const { headers, rows } = parse("sku;title;country\nA1;Widget;DE\n");
    expect(headers).toEqual(["sku", "title", "country"]);
    expect(rows[0]).toEqual(["A1", "Widget", "DE"]);
  });

  it("tolerates a missing trailing newline", () => {
    expect(parse("sku\nA1").rows).toEqual([["A1"]]);
  });

  it("returns nothing for an empty file", () => {
    expect(parse("")).toEqual({ headers: [], rows: [] });
  });

  it("refuses a file past the row cap", () => {
    // The scanner is unauthenticated, so the input size is an anonymous caller's choice.
    const big = "sku\n" + Array.from({ length: 20 }, (_, i) => `A${i}`).join("\n");
    expect(() => parse(big, 5)).toThrow(CsvTooLargeError);
  });
});
