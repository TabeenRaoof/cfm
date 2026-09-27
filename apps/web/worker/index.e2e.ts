/**
 * LOCAL END-TO-END ENTRY ONLY — wrangler.e2e.toml, never deployed (wrangler.toml points at
 * worker/index.ts). Replaces the model with a fake that answers from the text layer it's given, so
 * the whole Cloudflare path (upload → R2 → queue → extraction → database) runs with no API key and
 * no spend. Extraction quality against the real model is what the smoke scripts cover.
 */

import { FakeProvider, FRONTIER_PROFILE } from "../../../packages/ai/src/fake.ts";
import { createWorker } from "./app.ts";

/** Pulls the obvious values out of the test mandate's text, as a stand-in for a model. */
function answerFromText(text: string): Record<string, string | null> {
  const appoints = /hereby appoints\s+([^,]+),\s*([^,]+,\s*[^,]+),\s*([A-Za-z ]+),/.exec(text.replace(/\s+/g, " "));
  const manufacturer = /^\s*([^,]+),/.exec(text.replace(/MANDATE OF APPOINTMENT/, ""));
  const contact = /Contact:\s*(\S+@\S+)/.exec(text);
  return {
    rp_name: appoints?.[1]?.trim() ?? null,
    rp_address: appoints?.[2]?.trim() ?? null,
    rp_country: appoints?.[3]?.trim() === "Netherlands" ? "NL" : null,
    rp_contact: contact?.[1] ?? null,
    manufacturer_name: manufacturer?.[1]?.trim() ?? null,
  };
}

export default createWorker(() =>
  new FakeProvider("fake-e2e", FRONTIER_PROFILE, (request) => {
    const text = request.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
    return answerFromText(text);
  }),
);
