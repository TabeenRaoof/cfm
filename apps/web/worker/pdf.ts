/**
 * Reading a PDF's text layer locally — no model, no network. unpdf runs on both Node (tests) and
 * the Workers runtime (production), which a native renderer like pdfium would not (D-051).
 */

import { extractText, getDocumentProxy } from "unpdf";
import type { PdfReader } from "./process.ts";

export const unpdfReader: PdfReader = {
  async read(bytes) {
    // unpdf takes ownership of the buffer it's given; hand it a copy so the caller's bytes (which
    // may still go to the model as the PDF itself) are left intact.
    const pdf = await getDocumentProxy(bytes.slice());
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { text, pages: totalPages };
  },
};
