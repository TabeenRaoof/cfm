import { describe, expect, it } from "vitest";
import { isDocumentType, isUuid, safeFilename, sha256Hex, sniffMime, storageKey } from "../worker/upload.ts";

describe("sniffMime — the first bytes decide, not the browser's label", () => {
  it("recognises PDF, PNG and JPEG signatures", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("refuses anything else, including a script renamed to .pdf", () => {
    expect(sniffMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("PK\u0003\u0004"))).toBeNull(); // zip / docx
    expect(sniffMime(new Uint8Array([]))).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("is the standard SHA-256, lower-case hex", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("safeFilename", () => {
  it("strips any path, both slash styles", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\mandate.pdf")).toBe("mandate.pdf");
  });
  it("drops control characters and caps the length", () => {
    expect(safeFilename("a\u0000b\u0007c.pdf")).toBe("abc.pdf");
    expect(safeFilename("x".repeat(400))).toHaveLength(255);
  });
  it("never returns an empty name", () => {
    expect(safeFilename("/")).toBe("document");
  });
});

describe("keys and ids", () => {
  it("storage keys are organisation/sha256 — content-addressed, never user-controlled", () => {
    expect(storageKey("org", "abc")).toBe("org/abc");
  });
  it("accepts only the two Slice B document types and real UUIDs", () => {
    expect(isDocumentType("rp_mandate")).toBe(true);
    expect(isDocumentType("test_report")).toBe(false);
    expect(isUuid("a0000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("a0000000-0000-4000-8000-00000000000'; drop table")).toBe(false);
  });
});
