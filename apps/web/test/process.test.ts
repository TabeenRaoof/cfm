/**
 * Document processing (worker/process.ts, D-051), with real PDFs (pdf-lib), real text extraction
 * (unpdf), the real gateway and task, and a fake provider — every branch, no Cloudflare, no spend.
 */

import { Gateway, type GenerationRequest } from "@cfm/ai";
import { FakeProvider, FRONTIER_PROFILE, RecordingUsageSink } from "../../../packages/ai/src/fake.ts";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { unpdfReader } from "../worker/pdf.ts";
import {
  processDocument,
  reviewDocument,
  type DocumentStatus,
  type NewExtraction,
  type ProcessingStore,
  type StoredDocument,
} from "../worker/process.ts";

const MANDATE_LINES = [
  "MANDATE OF APPOINTMENT",
  "Nordholt Trading GmbH, Speicherstrasse 12, 20457 Hamburg, Germany, hereby appoints",
  "Compliance Bridge BV, Keizersgracht 1, 1015 Amsterdam, Netherlands,",
  "as its responsible person under Regulation (EU) 2023/988.",
  "Signed on: 03.02.2026",
];

async function pdfWith(lines: readonly string[], blankPages = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  if (lines.length > 0) {
    const page = doc.addPage();
    lines.forEach((line, i) => page.drawText(line, { x: 40, y: 760 - i * 18, size: 10, font }));
  }
  for (let i = 0; i < blankPages; i++) doc.addPage();
  return doc.save();
}

class MemoryProcessingStore implements ProcessingStore {
  readonly docs = new Map<string, StoredDocument & { error?: string | null }>();
  readonly extractions: NewExtraction[] = [];
  async getDocument(id: string) {
    return this.docs.get(id) ?? null;
  }
  async setStatus(id: string, status: DocumentStatus, error: string | null = null) {
    const doc = this.docs.get(id);
    if (doc) this.docs.set(id, { ...doc, status, error });
  }
  async hasPipelineExtraction(documentId: string, promptVersion: string) {
    return this.extractions.some((e) => e.document_id === documentId && e.source === "pipeline" && e.prompt_version === promptVersion);
  }
  readonly actors: (string | null)[] = [];
  async recordExtraction(row: NewExtraction, status: DocumentStatus, actor: string | null) {
    this.extractions.push(row);
    this.actors.push(actor);
    await this.setStatus(row.document_id, status, null);
  }
}

const RP_VALUES = {
  rp_name: "Compliance Bridge BV",
  rp_address: "Keizersgracht 1, 1015 Amsterdam",
  rp_country: "NL",
  manufacturer_name: "Nordholt Trading GmbH",
};

function setup(options: { file?: Uint8Array | null; mime?: string; respond?: (r: GenerationRequest) => unknown } = {}) {
  const store = new MemoryProcessingStore();
  store.docs.set("doc-1", {
    id: "doc-1", organisation_id: "org-1", doc_type: "rp_mandate",
    mime: options.mime ?? "application/pdf", storage_key: "org-1/doc-1", status: "queued",
  });
  const files = new Map<string, Uint8Array>();
  if (options.file) files.set("org-1/doc-1", options.file);
  const provider = new FakeProvider("fake", FRONTIER_PROFILE, options.respond ?? (() => RP_VALUES));
  const usage = new RecordingUsageSink();
  const gateway = new Gateway({ provider, models: { extract: "fake-model", classify: "fake-model" }, usage });
  const deps = {
    store,
    storage: { get: async (key: string) => files.get(key) ?? null },
    gateway,
    lastUsage: () => usage.entries.at(-1) ?? null,
    pdf: unpdfReader,
    today: () => "2026-09-26",
  };
  return { deps, store, provider, usage };
}

describe("a PDF with a text layer", () => {
  it("reads the text locally, asks the model only for what the patterns didn't find, and accepts", async () => {
    const { deps, store, provider } = setup({ file: await pdfWith(MANDATE_LINES) });
    const outcome = await processDocument(deps, "doc-1");

    expect(outcome).toEqual({ kind: "extracted", decision: "accept", usedModel: true });
    // Text only — the PDF itself is never sent when its text is usable.
    expect(provider.calls[0]?.parts.every((p) => p.type === "text")).toBe(true);
    // issue_date was found by a confirmed pattern ("Signed on: 03.02.2026"), so it isn't asked for.
    const asked = Object.keys((provider.calls[0]?.schema as { properties: object }).properties);
    expect(asked).not.toContain("issue_date");
    expect(asked).toContain("rp_name");

    const saved = store.extractions[0]!;
    expect(saved).toMatchObject({ decision: "accept", source: "pipeline", used_model: true, provider: "fake", reviewed_by: null });
    expect(store.actors[0]).toBeNull(); // the pipeline acts as the system
    expect(saved.verdict.fields.find((f) => f.key === "issue_date")).toMatchObject({ value: "2026-02-03", source: "pattern" });
    expect(store.docs.get("doc-1")?.status).toBe("accepted");
  });

  it("sends it for review — never accepts — when the model leaves a required field out", async () => {
    const { rp_address: _dropped, ...partial } = RP_VALUES;
    const { deps, store } = setup({ file: await pdfWith(MANDATE_LINES), respond: () => partial });
    const outcome = await processDocument(deps, "doc-1");
    expect(outcome).toMatchObject({ kind: "extracted", decision: "review" });
    expect(store.extractions[0]?.verdict.reasons.join(" ")).toMatch(/rp_address/);
    expect(store.docs.get("doc-1")?.status).toBe("needs_review");
  });

  it("ignores anything the model claims about its own confidence", async () => {
    const { deps, store } = setup({
      file: await pdfWith(MANDATE_LINES),
      respond: () => ({ ...RP_VALUES, rp_country: "Netherlands", confidence: 0.99 }),
    });
    await processDocument(deps, "doc-1");
    // "Netherlands" isn't an ISO code: the validators send it to review whatever the model says.
    expect(store.extractions[0]?.decision).toBe("review");
  });
});

describe("a scan with no text layer", () => {
  it("sends the PDF itself, with its real page count", async () => {
    const { deps, provider } = setup({ file: await pdfWith([], 2) });
    await processDocument(deps, "doc-1");
    const part = provider.calls[0]?.parts[0];
    expect(part?.type).toBe("pdf");
    expect(part && part.type === "pdf" ? part.pages : 0).toBe(2);
  });

  it("too long for the budget: nothing is sent, and a person is asked to enter it by hand", async () => {
    const { deps, store, provider } = setup({ file: await pdfWith([], 40) });
    const outcome = await processDocument(deps, "doc-1");
    expect(outcome.kind).toBe("too-long");
    expect(provider.calls).toHaveLength(0);
    expect(store.extractions).toHaveLength(0);
    expect(store.docs.get("doc-1")?.status).toBe("needs_review");
  });
});

describe("images", () => {
  it("a photo goes to the model as an image", async () => {
    const { deps, provider } = setup({ file: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), mime: "image/png" });
    await processDocument(deps, "doc-1");
    expect(provider.calls[0]?.parts[0]?.type).toBe("image");
  });
});

describe("delivery and failure", () => {
  it("a redelivered message doesn't pay for the same document twice", async () => {
    const { deps, provider } = setup({ file: await pdfWith(MANDATE_LINES) });
    await processDocument(deps, "doc-1");
    const again = await processDocument(deps, "doc-1");
    expect(again.kind).toBe("already-processed");
    expect(provider.calls).toHaveLength(1);
  });

  it("a file missing from storage fails the document, without a model call", async () => {
    const { deps, store, provider } = setup({ file: null });
    expect((await processDocument(deps, "doc-1")).kind).toBe("failed");
    expect(store.docs.get("doc-1")?.status).toBe("failed");
    expect(provider.calls).toHaveLength(0);
  });

  it("a provider error is rethrown so the queue retries it", async () => {
    const { deps } = setup({ file: await pdfWith(MANDATE_LINES), respond: () => { throw new Error("upstream 529"); } });
    await expect(processDocument(deps, "doc-1")).rejects.toThrow(/529/);
  });

  it("an unknown document id is reported, not thrown", async () => {
    const { deps } = setup();
    expect(await processDocument(deps, "nope")).toEqual({ kind: "missing" });
  });
});

describe("human review", () => {
  it("typed values pass the same validators — an impossible date is refused, nothing stored", async () => {
    const { deps, store } = setup();
    const outcome = await reviewDocument(deps, "doc-1", { ...RP_VALUES, issue_date: "2026-02-30" }, "user-1");
    expect(outcome.kind).toBe("rejected");
    expect(store.extractions).toHaveLength(0);
  });

  it("a complete, valid review is stored as human-sourced, with the reviewer, and accepts the document", async () => {
    const { deps, store } = setup();
    const outcome = await reviewDocument(deps, "doc-1", { ...RP_VALUES, issue_date: "2026-02-03", injected: "x" }, "user-1");
    expect(outcome).toEqual({ kind: "accepted" });
    expect(store.extractions[0]).toMatchObject({ source: "human", reviewed_by: "user-1", decision: "accept", used_model: false });
    expect(store.actors[0]).toBe("user-1");
    expect(store.extractions[0]?.verdict.fields.map((f) => f.key)).not.toContain("injected");
    expect(store.docs.get("doc-1")?.status).toBe("accepted");
  });
});
