/** Small request/response helpers shared by the route handlers. */

const MAX_BODY_BYTES = 4096; // `05-interim-waitlist-plan.md` §3.2

/**
 * Reads a form-encoded POST body, refusing anything over the size cap before parsing it. A
 * request this small has no legitimate reason to be larger — this isn't a file upload — so an
 * oversized body is treated as abuse rather than a user error worth a friendly page.
 */
export async function readFormBody(request: Request): Promise<URLSearchParams | null> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  return new URLSearchParams(text);
}

export function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

export function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Field value from a URLSearchParams as `unknown`, matching what `validateSubscription` expects. */
export function field(params: URLSearchParams, name: string): unknown {
  return params.has(name) ? params.get(name) : undefined;
}
