/**
 * The web Worker's API (D-051). Every route verifies the caller's Supabase session first and reads
 * as that caller under RLS; writes go through migration 0003's service-role functions, which check
 * the role again in the database. Two independent checks, one of which is the database itself.
 */

import type { FieldValue } from "@cfm/documents";
import type { Env } from "./env.ts";
import { reviewDocument } from "./process.ts";
import { callerClient, serviceClient, supabaseStore } from "./supabase-store.ts";
import {
  isDocumentType,
  isUuid,
  MAX_UPLOAD_BYTES,
  safeFilename,
  sha256Hex,
  sniffMime,
  storageKey,
} from "./upload.ts";

type Role = "owner" | "admin" | "member" | "viewer";
const CAN_UPLOAD: readonly Role[] = ["owner", "admin", "member"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

interface Caller {
  readonly userId: string;
  readonly jwt: string;
}

async function authenticate(request: Request, env: Env): Promise<Caller | Response> {
  const header = request.headers.get("Authorization") ?? "";
  const jwt = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!jwt) return json(401, { error: "Sign in first." });
  const { data, error } = await callerClient(env, jwt).auth.getUser(jwt);
  if (error || !data.user) return json(401, { error: "Your session has expired — sign in again." });
  return { userId: data.user.id, jwt };
}

/** The caller's role in an organisation, read as the caller — RLS returns nothing for a non-member. */
async function roleIn(env: Env, caller: Caller, organisationId: string): Promise<Role | null> {
  const { data } = await callerClient(env, caller.jwt)
    .from("membership")
    .select("role")
    .eq("organisation_id", organisationId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

async function upload(request: Request, env: Env, caller: Caller): Promise<Response> {
  if (env.UPLOADS_ENABLED !== "true") {
    return json(503, { error: "Document uploads are switched off until the privacy paperwork (D-013) is in place." });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "Expected a multipart form upload." });
  }
  const file = form.get("file");
  const organisationId = form.get("organisation_id");
  const docType = form.get("doc_type");
  const productIds = form.getAll("product_id").filter((v) => typeof v === "string") as string[];

  if (!(file instanceof File)) return json(400, { error: "No file in the upload." });
  if (!isUuid(organisationId)) return json(400, { error: "Missing or invalid organisation." });
  if (!isDocumentType(docType)) return json(400, { error: "Choose the document type: RP mandate or EPR certificate." });
  if (!productIds.every(isUuid)) return json(400, { error: "Invalid product id." });
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return json(413, { error: "Files must be between 1 byte and 10 MB." });

  const role = await roleIn(env, caller, organisationId);
  if (!role || !CAN_UPLOAD.includes(role)) return json(403, { error: "You can't upload documents to this organisation." });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return json(415, { error: "Only PDF, PNG and JPEG files are accepted." });

  const sha256 = await sha256Hex(bytes);
  const service = serviceClient(env);
  const existing = await service.from("document").select("id").eq("organisation_id", organisationId).eq("sha256", sha256).maybeSingle();
  if (existing.data) return json(409, { error: "This file has already been uploaded.", documentId: existing.data.id });

  const key = storageKey(organisationId, sha256);
  await env.DOCS.put(key, bytes, { httpMetadata: { contentType: mime } });

  const registered = await service.rpc("register_document", {
    p_actor: caller.userId,
    p_organisation_id: organisationId,
    p_doc_type: docType,
    p_filename: safeFilename(file.name),
    p_mime: mime,
    p_byte_size: bytes.byteLength,
    p_sha256: sha256,
    p_storage_key: key,
    p_product_ids: productIds,
  });
  if (registered.error) {
    await env.DOCS.delete(key); // nothing in the database refers to it, so it mustn't linger
    const forbidden = /not permitted/.test(registered.error.message);
    return json(forbidden ? 403 : 400, { error: forbidden ? "You can't upload documents to this organisation." : registered.error.message });
  }
  const documentId = registered.data as string;
  await env.DOC_QUEUE.send({ documentId });
  return json(201, { documentId });
}

async function download(env: Env, caller: Caller, documentId: string): Promise<Response> {
  const { data: doc } = await callerClient(env, caller.jwt)
    .from("document")
    .select("storage_key, filename, mime")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return json(404, { error: "Document not found." });
  const object = await env.DOCS.get(doc.storage_key as string);
  if (!object) return json(404, { error: "The file is missing from storage." });
  return new Response(object.body, {
    headers: {
      "Content-Type": doc.mime as string,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename as string)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function review(request: Request, env: Env, caller: Caller, documentId: string): Promise<Response> {
  const { data: doc } = await callerClient(env, caller.jwt)
    .from("document")
    .select("organisation_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return json(404, { error: "Document not found." });
  const role = await roleIn(env, caller, doc.organisation_id as string);
  if (!role || !CAN_UPLOAD.includes(role)) return json(403, { error: "Viewers can't review documents." });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Expected JSON." });
  }
  const values = (body as { values?: unknown } | null)?.values;
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return json(400, { error: "Expected { values: { field: value } }." });
  }
  const outcome = await reviewDocument(
    { store: supabaseStore(serviceClient(env)), today: () => new Date().toISOString().slice(0, 10) },
    documentId,
    values as Record<string, FieldValue>,
    caller.userId,
  );
  if (outcome.kind === "missing") return json(404, { error: "Document not found." });
  if (outcome.kind === "rejected") return json(422, { error: "Not accepted yet.", reasons: outcome.reasons, invalidFields: outcome.invalidFields });
  return json(200, { status: "accepted" });
}

async function remove(env: Env, caller: Caller, documentId: string): Promise<Response> {
  const { data, error } = await serviceClient(env).rpc("delete_document", { p_actor: caller.userId, p_document_id: documentId });
  if (error) {
    if (/not permitted/.test(error.message)) return json(403, { error: "Only owners and admins can delete documents." });
    if (/not found/.test(error.message)) return json(404, { error: "Document not found." });
    return json(500, { error: "Couldn't delete the document." });
  }
  await env.DOCS.delete(data as string);
  return new Response(null, { status: 204 });
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const caller = await authenticate(request, env);
  if (caller instanceof Response) return caller;

  if (url.pathname === "/api/documents" && request.method === "POST") return upload(request, env, caller);

  const match = /^\/api\/documents\/([0-9a-f-]{36})(\/file|\/review)?$/.exec(url.pathname);
  if (match && isUuid(match[1])) {
    const [, id, action] = match as unknown as [string, string, string | undefined];
    if (action === "/file" && request.method === "GET") return download(env, caller, id);
    if (action === "/review" && request.method === "POST") return review(request, env, caller, id);
    if (action === undefined && request.method === "DELETE") return remove(env, caller, id);
  }
  return json(404, { error: "No such endpoint." });
}
