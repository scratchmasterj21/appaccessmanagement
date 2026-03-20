/**
 * DEPRECATED: Playtime is now tracked server-side by check-access via accruePlaytime.
 * This endpoint is kept as a no-op so existing clients that still call it don't break.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Secret',
  'Content-Type': 'application/json',
};

export const handler = async (event: { httpMethod: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: true, deprecated: true, message: 'Playtime is now tracked server-side.' }),
  };
};
