/**
 * Browsers send a CORS preflight for any request carrying a header outside
 * the CORS-safelisted set, and the legacy www.animu.moe endpoints answer
 * preflights without `Access-Control-Allow-Headers`. Two headers the API
 * package sets by default are never needed from a browser:
 *
 * - `User-Agent`: the browser sends its own (and identifies itself by it);
 * - `Content-Type` on a request without a body: it describes nothing.
 *
 * Dropping them keeps plain GETs "simple", so they need no preflight at all.
 * Requests with a body keep their content type (a JSON POST still needs the
 * server to allow it).
 */
export function asSimpleRequest<T extends { headers?: unknown; body?: unknown }>(init: T | undefined): T | undefined {
  if (!init?.headers) return init;
  const headers = new Headers(init.headers as HeadersInit);
  headers.delete("user-agent");
  if (init.body == null) headers.delete("content-type");
  return { ...init, headers };
}
