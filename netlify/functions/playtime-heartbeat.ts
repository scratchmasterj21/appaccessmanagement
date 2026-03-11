/**
 * Record playtime: add minutes for a user+app for today (JST).
 * POST body: { email, appId, minutesToAdd }.
 */

import { getTodayJST, playtimeBlobKey } from './_shared/accessCheck';
import { getPlaytimeStore } from './_shared/blobs';
import type { PlaytimeUsage } from './_shared/accessCheck';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const handler = async (event: { httpMethod: string; body?: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let email = '';
  let appId = '';
  let minutesToAdd = 0;

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    email = (body.email || '').trim().toLowerCase();
    appId = (body.appId || '').trim().toLowerCase();
    minutesToAdd = Math.max(0, Number(body.minutesToAdd) || 0);
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!email || !appId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing email or appId' }),
    };
  }

  if (minutesToAdd <= 0) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true, totalMinutes: 0, appMinutes: 0 }),
    };
  }

  try {
    const store = getPlaytimeStore(event);
    const today = getTodayJST();
    const key = playtimeBlobKey(email, today);

    const existing = (await store.get(key, { type: 'json' })) as PlaytimeUsage | null;
    const totalMinutes = (existing?.totalMinutes ?? 0) + minutesToAdd;
    const apps = { ...(existing?.apps ?? {}) };
    apps[appId] = (apps[appId] ?? 0) + minutesToAdd;

    const next: PlaytimeUsage = {
      totalMinutes,
      apps,
      lastActivityAt: new Date().toISOString(),
    };

    await store.setJSON(key, next);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        totalMinutes,
        appMinutes: apps[appId],
        date: today,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
