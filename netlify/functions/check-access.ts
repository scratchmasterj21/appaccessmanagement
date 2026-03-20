/**
 * Single endpoint for access check: schedule + playtime.
 * GET or POST with email, appId. Returns { allowed, reason?, timeLeftMinutes?, usedTodayMinutes?, scheduleAllowed?, playtimeAllowed? }.
 */

import type { AccessConfigRaw, PlaytimeUsage } from './_shared/accessCheck';
import { getPlaytimeStore } from './_shared/blobs';
import { isAuthorizedBySharedSecret } from './_shared/requestAuth';
import {
  getTodayJST,
  getCurrentJST,
  getScheduleDebugInfo,
  normalizeConfig,
  checkSchedule,
  checkPlaytime,
  accruePlaytime,
  playtimeBlobKey,
  isBeforeOrAtTime,
} from './_shared/accessCheck';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Secret',
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

export const handler = async (event: { httpMethod: string; headers?: Record<string, string>; queryStringParameters?: Record<string, string>; body?: string }) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (!isAuthorizedBySharedSecret(event)) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        allowed: false,
        reason: 'Unauthorized',
        error: 'Unauthorized',
      }),
    };
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
        body: JSON.stringify({
          allowed: false,
          reason: 'Invalid JSON body',
          error: 'Invalid JSON body',
        }),
      };
    }
  }

  if (!email || !appId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        allowed: false,
        reason: 'Missing email or appId',
        error: 'Missing email or appId',
      }),
    };
  }

  try {
    const config = await fetchAccessConfig();
    const now = new Date();
    const allowlist = config.allowlist ?? [];
    const isAllowlisted = allowlist.includes(email);
    const limitedEntry = config.limitedAllowlist?.[email];

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

    const store = getPlaytimeStore(event);
    const today = getTodayJST();
    const key = playtimeBlobKey(email, today);
    const usageRaw = await store.get(key, { type: 'json' });
    const rawUsage = usageRaw as PlaytimeUsage | null;

    // Server-side accrual: compute minutes since last seen and update usage
    const usage = accruePlaytime(rawUsage, appId, now);

    if (limitedEntry) {
      const untilTime = limitedEntry.allowedUntilTime?.trim();
      if (untilTime) {
        const { timeJST } = getCurrentJST(now);
        if (!isBeforeOrAtTime(timeJST, untilTime)) {
          await store.setJSON(key, usage);
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              allowed: false,
              reason: `Outside your allowed time. You can play until ${untilTime} (JST).`,
              scheduleAllowed: true,
              playtimeAllowed: true,
              timeLeftMinutes: 0,
              usedTodayMinutes: usage.apps[appId] ?? 0,
              usedTotalMinutes: usage.totalMinutes,
            }),
          };
        }
      }
      const playtimeResult = checkPlaytime(
        config,
        email,
        appId,
        usage,
        limitedEntry.dailyPlaytimeLimitMinutes
      );
      await store.setJSON(key, usage);
      const allowed = playtimeResult.allowed;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          allowed,
          reason: allowed ? undefined : 'Daily playtime limit reached. You have used your allowed time for today.',
          scheduleAllowed: true,
          playtimeAllowed: allowed,
          timeLeftMinutes: playtimeResult.timeLeftMinutes,
          usedTodayMinutes: playtimeResult.usedTodayMinutes,
          usedTotalMinutes: playtimeResult.usedTotalMinutes,
        }),
      };
    }

    const scheduleResult = checkSchedule(config, email, appId, now);

    if (!scheduleResult.allowed) {
      const debug = getScheduleDebugInfo(config, email, appId, now);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          allowed: false,
          reason: scheduleResult.reason,
          scheduleAllowed: false,
          playtimeAllowed: true,
          timeLeftMinutes: 0,
          usedTodayMinutes: usage.apps[appId] ?? 0,
          usedTotalMinutes: usage.totalMinutes,
          currentTimeJST: debug.currentTimeJST,
          currentDateJST: debug.currentDateJST,
          checkedWindows: debug.checkedWindows,
          appFound: debug.appFound,
          dayOfWeekJST: debug.dayOfWeek,
        }),
      };
    }

    const playtimeResult = checkPlaytime(config, email, appId, usage);
    await store.setJSON(key, usage);

    const allowed = playtimeResult.allowed;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        allowed,
        reason: allowed ? undefined : 'Daily playtime limit reached. You have used your allowed time for today.',
        scheduleAllowed: true,
        playtimeAllowed: allowed,
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
      body: JSON.stringify({
        allowed: false,
        reason: message,
        error: message,
      }),
    };
  }
};
