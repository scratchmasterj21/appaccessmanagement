export const ACCESS_SECRET_HEADER = 'x-access-secret';

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v;
  }
  return out;
}

/**
 * Require a shared secret for server-to-server calls.
 * Set NETLIFY_FUNCTION_SHARED_SECRET in Netlify env and send it as X-Access-Secret from the caller.
 */
export function isAuthorizedBySharedSecret(event: unknown): boolean {
  const expected = process.env.NETLIFY_FUNCTION_SHARED_SECRET;
  if (!expected) return false;
  const headers = normalizeHeaders((event as { headers?: unknown } | null)?.headers);
  const got = headers[ACCESS_SECRET_HEADER];
  return typeof got === 'string' && got.length > 0 && got === expected;
}
