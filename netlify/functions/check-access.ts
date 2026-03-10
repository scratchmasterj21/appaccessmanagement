/**
 * Single endpoint for access check: schedule + playtime.
 * GET or POST with email, appId. Returns { allowed, reason?, timeLeftMinutes?, usedTodayMinutes?, scheduleAllowed?, playtimeAllowed? }.
 */

import { getStore } from '@netlify/blobs';
import type { AccessConfigRaw, PlaytimeUsage } from './_shared/accessCheck';
import {
  getTodayJST,
  normalizeConfig,
  checkSchedule,
  checkPlaytime,
  playtimeBlobKey,
} from './_shared/accessCheck';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const CONFIG_CACHE_MS = 2 * 60 * 1000; // 2 minutes
let configCache: { data: AccessConfigRaw | null; ts: number } = { data: null, ts: 0 };

async function fetchAccessConfig(): Promise<AccessConfigRaw> {
  const now = Date.now();
  if (configCache.data && now - configCache.ts < CONFIG_CACHE_MS) {
    return configCache.data;
  }
  const baseUrl = process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL;
  if (!baseUrl) {
    throw new Error('Missing FIREBASE_DATABASE_URL or VITE_FIREBASE_DATABASE_URL');
  }
  const url = `${baseUrl.replace(/\/$/, '')}/accessConfig.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Firebase config fetch failed: ${res.status}`);
  }
  const raw = (await res.json()) as AccessConfigRaw;
  const config = normalizeConfig(raw);
  configCache = { data: config, ts: now };
  return config;
}

export const handler = async (event: { httpMethod: string; queryStringParameters?: Record<string, string>; body?: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const method = event.httpMethod;
  let email = '';
  let appId = '';

  if (method === 'GET' && event.queryStringParameters) {
    email = (event.queryStringParameters.email || '').trim().toLowerCase();
    appId = (event.queryStringParameters.appId || '').trim().toLowerCase();
  } else if ((method === 'POST' || method === 'GET') && event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      email = (body.email || '').trim().toLowerCase();
      appId = (body.appId || '').trim().toLowerCase();
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON body', allowed: false }),
      };
    }
  }

  if (!email || !appId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing email or appId', allowed: false }),
    };
  }

  try {
    const config = await fetchAccessConfig();
    const now = new Date();
    const allowlist = config.allowlist ?? [];
    const isAllowlisted = allowlist.includes(email);

    const scheduleResult = checkSchedule(config, email, appId, now);

    if (!scheduleResult.allowed) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          allowed: false,
          reason: scheduleResult.reason,
          scheduleAllowed: false,
          playtimeAllowed: true,
          timeLeftMinutes: 0,
          usedTodayMinutes: 0,
        }),
      };
    }

    if (isAllowlisted) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          allowed: true,
          scheduleAllowed: true,
          playtimeAllowed: true,
          timeLeftMinutes: 999,
          usedTodayMinutes: 0,
        }),
      };
    }

    const store = getStore({ name: 'playtime-usage' });
    const today = getTodayJST();
    const key = playtimeBlobKey(email, today);
    const usageRaw = await store.get(key, { type: 'json' });
    const usage = usageRaw as PlaytimeUsage | null;

    const playtimeResult = checkPlaytime(config, email, appId, usage);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        allowed: playtimeResult.allowed,
        reason: playtimeResult.allowed ? undefined : 'daily playtime limit reached',
        scheduleAllowed: true,
        playtimeAllowed: playtimeResult.allowed,
        timeLeftMinutes: playtimeResult.timeLeftMinutes,
        usedTodayMinutes: playtimeResult.usedTodayMinutes,
        usedTotalMinutes: playtimeResult.usedTotalMinutes,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message, allowed: false }),
    };
  }
};
