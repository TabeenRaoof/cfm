/**
 * Upload checks, pure so they're tested without a runtime (test/upload.test.ts). `02-` §9: "size
 * limits, MIME sniffing". The browser's claimed type is ignored — the first bytes decide.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches document.byte_size's CHECK (migration 0003)
export const DOCUMENT_TYPES = ["rp_mandate", "epr_certificate"] as const;
export type UploadMime = "application/pdf" | "image/png" | "image/jpeg";

/** The file's real type from its signature, or null if it isn't one we accept. */
export function sniffMime(bytes: Uint8Array): UploadMime | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  return null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A display name only — never a path. Storage keys are org/sha256, not filenames. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // Drop control characters by code point, then trim to the database's 255 limit.
  const cleaned = [...base].filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f).join("").trim();
  return (cleaned || "document").slice(0, 255);
}

export function storageKey(organisationId: string, sha256: string): string {
  return `${organisationId}/${sha256}`;
}

export function isDocumentType(value: unknown): value is (typeof DOCUMENT_TYPES)[number] {
  return typeof value === "string" && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
