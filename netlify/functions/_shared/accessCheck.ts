/**
 * Schedule + playtime check logic for the unified check-access endpoint.
 * Uses JST (Asia/Tokyo) for "today" and time windows.
 */

import { encodeKey } from './keys';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface TimeWindow {
  start: string; // HH:MM
  end: string;
}

export interface Schedule {
  monday?: TimeWindow[];
  tuesday?: TimeWindow[];
  wednesday?: TimeWindow[];
  thursday?: TimeWindow[];
  friday?: TimeWindow[];
  saturday?: TimeWindow[];
  sunday?: TimeWindow[];
  weekdays?: TimeWindow[];
  weekends?: TimeWindow[];
}

export interface Blackout {
  start: string;
  end: string;
  reason?: string;
}

export interface AppConfig {
  schedule: Schedule;
  blocked?: boolean;
  reason?: string;
  dailyPlaytimeLimitMinutes?: number;
}

export interface UserAppOverride {
  blocked?: boolean;
  reason?: string;
  schedule?: Schedule;
  dailyPlaytimeLimitMinutes?: number;
}

export interface UserLimit {
  dailyPlaytimeLimitMinutes?: number;
}

export interface AccessConfigRaw {
  defaultAllow: boolean;
  apps: Record<string, AppConfig>;
  users?: Record<string, Record<string, UserAppOverride>>;
  blackouts?: Blackout[];
  allowlist?: string[];
  dailyPlaytimeLimitMinutes?: number;
  userLimits?: Record<string, UserLimit>;
}

/** Day names in order Sunday=0 to Saturday=6 (JS getDay()). */
const DAY_NAMES: (keyof Schedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const SCHEDULE_KEYS: (keyof Schedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends'];

function isTimeWindow(w: unknown): w is TimeWindow {
  return !!w && typeof w === 'object' && typeof (w as TimeWindow).start === 'string' && typeof (w as TimeWindow).end === 'string';
}

/** Firebase can return arrays as { "0": x, "1": y }. Convert to real array. */
function toTimeWindowArray(val: unknown): TimeWindow[] {
  if (Array.isArray(val)) return val.filter(isTimeWindow);
  if (!val || typeof val !== 'object') return [];
  const o = val as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => o[k]).filter(isTimeWindow);
}

/** Normalize schedule from Firebase so weekdays/weekends/each day are always TimeWindow[]. */
function normalizeSchedule(schedule: Record<string, unknown> | null | undefined): Schedule {
  if (!schedule || typeof schedule !== 'object') return {};
  const out: Schedule = {};
  for (const k of SCHEDULE_KEYS) {
    const arr = toTimeWindowArray(schedule[k]);
    if (arr.length > 0) (out as Record<string, TimeWindow[]>)[k] = arr;
  }
  return out;
}

/** Get current date in JST as YYYY-MM-DD. */
export function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get current time in JST as HH:MM. */
function getTimeJST(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const m = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Return current time and date in JST for debugging (schedule uses JST). */
export function getCurrentJST(now: Date): { timeJST: string; dateJST: string } {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const min = String(jst.getUTCMinutes()).padStart(2, '0');
  return { timeJST: `${h}:${min}`, dateJST: `${y}-${mo}-${d}` };
}

/** Get the windows we're checking for schedule (for debug when denying "outside schedule"). */
export function getScheduleDebugInfo(
  config: AccessConfigRaw,
  email: string,
  appId: string,
  now: Date
): { currentTimeJST: string; currentDateJST: string; dayOfWeek: number; checkedWindows: TimeWindow[]; appFound: boolean } {
  const jst = getCurrentJST(now);
  const jstDate = new Date(now.getTime() + JST_OFFSET_MS);
  const dayOfWeek = jstDate.getUTCDay();
  const app = config.apps?.[appId.toLowerCase()];
  const appFound = !!app;
  const override = config.users?.[email.toLowerCase()]?.[appId.toLowerCase()];
  const schedule = override?.schedule ?? app?.schedule;
  const windows = schedule ? getWindowsForDay(schedule, dayOfWeek) : [];
  return {
    currentTimeJST: jst.timeJST,
    currentDateJST: jst.dateJST,
    dayOfWeek,
    checkedWindows: windows,
    appFound,
  };
}

/** Parse HH:MM to minutes since midnight. */
function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True if time (HH:MM) is inside window [start, end). End is exclusive. */
function isInWindow(timeMinutes: number, window: TimeWindow): boolean {
  const start = parseHHMM(window.start);
  const end = parseHHMM(window.end);
  if (end <= start) return timeMinutes >= start || timeMinutes < end; // spans midnight
  return timeMinutes >= start && timeMinutes < end;
}

/** Get windows that apply for the given day (0=Sun .. 6=Sat). Prefer specific day over weekdays/weekends. */
function getWindowsForDay(schedule: Schedule, dayOfWeek: number): TimeWindow[] {
  const dayName = DAY_NAMES[dayOfWeek];
  const specific = schedule[dayName];
  if (Array.isArray(specific) && specific.length > 0) return specific;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const fallback = isWeekend ? schedule.weekends : schedule.weekdays;
  return Array.isArray(fallback) ? fallback : [];
}

/** True if current time (in JST) is within the schedule. */
export function isWithinSchedule(now: Date, schedule: Schedule): boolean {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const dayOfWeek = jst.getUTCDay();
  const timeStr = getTimeJST(now);
  const timeMinutes = parseHHMM(timeStr);
  const windows = getWindowsForDay(schedule, dayOfWeek);
  return windows.some((w) => isInWindow(timeMinutes, w));
}

/** True if now is inside any blackout interval. */
export function isInBlackout(now: Date, blackouts: Blackout[]): boolean {
  const t = now.getTime();
  for (const b of blackouts) {
    const start = new Date(b.start).getTime();
    const end = new Date(b.end).getTime();
    if (t >= start && t <= end) return true;
  }
  return false;
}

/** Decode Firebase-style key (e.g. from REST response). */
function decodeKey(key: string): string {
  const MAP: [string, string][] = [
    ['.', '__DOT__'],
    ['#', '__HASH__'],
    ['$', '__DOLLAR__'],
    ['/', '__SLASH__'],
    ['[', '__OB__'],
    [']', '__CB__'],
  ];
  let s = key;
  for (const [char, placeholder] of MAP) {
    s = s.split(placeholder).join(char);
  }
  return s;
}

/** Normalize apps/users from Firebase (encoded keys -> decoded, schedules as arrays). Keys lowercased for case-insensitive lookup. */
export function normalizeConfig(raw: AccessConfigRaw): AccessConfigRaw {
  const apps: Record<string, AppConfig> = {};
  for (const k of Object.keys(raw.apps || {})) {
    const app = raw.apps[k];
    const appId = decodeKey(k).toLowerCase();
    apps[appId] = {
      ...app,
      schedule: normalizeSchedule(app?.schedule as Record<string, unknown>),
    };
  }
  const users: Record<string, Record<string, UserAppOverride>> = {};
  for (const encEmail of Object.keys(raw.users || {})) {
    const email = decodeKey(encEmail).toLowerCase();
    const inner = raw.users![encEmail];
    const overrides: Record<string, UserAppOverride> = {};
    if (inner && typeof inner === 'object') {
      for (const encAppId of Object.keys(inner)) {
        const ov = inner[encAppId];
        const aid = decodeKey(encAppId).toLowerCase();
        overrides[aid] = {
          ...ov,
          schedule: ov?.schedule ? normalizeSchedule(ov.schedule as Record<string, unknown>) : undefined,
        };
      }
    }
    users[email] = overrides;
  }
  const userLimits: Record<string, UserLimit> = {};
  for (const encEmail of Object.keys(raw.userLimits || {})) {
    userLimits[decodeKey(encEmail).toLowerCase()] = raw.userLimits![encEmail];
  }
  const allowlist: string[] = Array.isArray(raw.allowlist)
    ? raw.allowlist.map((e) => (typeof e === 'string' ? e.toLowerCase() : String(e)))
    : [];
  return {
    ...raw,
    apps,
    users,
    allowlist,
    userLimits: Object.keys(userLimits).length ? userLimits : raw.userLimits,
  };
}

export interface ScheduleCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Check schedule + blocked + blackout. Allowlist bypasses everything. Email/appId should be lowercase. */
export function checkSchedule(
  config: AccessConfigRaw,
  email: string,
  appId: string,
  now: Date
): ScheduleCheckResult {
  const allowlist = config.allowlist ?? [];
  const emailLower = email.toLowerCase();
  if (allowlist.some((e) => (typeof e === 'string' ? e.toLowerCase() : e) === emailLower)) {
    return { allowed: true };
  }

  if (isInBlackout(now, config.blackouts ?? [])) {
    return { allowed: false, reason: 'blackout' };
  }

  const app = config.apps?.[appId];
  if (!app) {
    return { allowed: config.defaultAllow ?? false, reason: config.defaultAllow ? undefined : 'app not configured' };
  }

  if (app.blocked) {
    return { allowed: false, reason: 'app blocked' };
  }

  const override = config.users?.[email]?.[appId];
  const schedule = override?.schedule ?? app.schedule;
  if (!schedule || Object.keys(schedule).length === 0) {
    return { allowed: config.defaultAllow ?? false, reason: config.defaultAllow ? undefined : 'no schedule' };
  }

  if (!isWithinSchedule(now, schedule)) {
    return { allowed: false, reason: 'outside schedule' };
  }

  if (override?.blocked) {
    return { allowed: false, reason: 'blocked for user' };
  }

  return { allowed: true };
}

/** Get effective daily playtime limit (minutes) for this user+app. 0 or undefined = no limit. */
export function getPlaytimeLimit(config: AccessConfigRaw, email: string, appId: string): number | null {
  const globalLimit = config.dailyPlaytimeLimitMinutes;
  const appLimit = config.apps?.[appId]?.dailyPlaytimeLimitMinutes;
  const userAppLimit = config.users?.[email]?.[appId]?.dailyPlaytimeLimitMinutes;

  const limit = userAppLimit ?? appLimit ?? globalLimit;
  if (limit === undefined || limit === null || limit <= 0) return null;
  return limit;
}

/** Get per-user total daily cap (minutes across all apps). */
export function getUserTotalCap(config: AccessConfigRaw, email: string): number | null {
  const cap = config.userLimits?.[email]?.dailyPlaytimeLimitMinutes;
  if (cap === undefined || cap === null || cap <= 0) return null;
  return cap;
}

export interface PlaytimeUsage {
  totalMinutes: number;
  apps: Record<string, number>;
  lastActivityAt?: string;
}

export interface PlaytimeCheckResult {
  allowed: boolean;
  timeLeftMinutes: number;
  usedTodayMinutes: number;
  usedTotalMinutes: number;
}

/** Check playtime: allowed if under limit. Allowlist is exempt (caller should skip if allowlist). */
export function checkPlaytime(
  config: AccessConfigRaw,
  email: string,
  appId: string,
  usage: PlaytimeUsage | null
): PlaytimeCheckResult {
  const usedThisApp = usage?.apps?.[appId] ?? 0;
  const usedTotal = usage?.totalMinutes ?? 0;

  const limit = getPlaytimeLimit(config, email, appId);
  const userTotalCap = getUserTotalCap(config, email);

  if (limit === null && userTotalCap === null) {
    return { allowed: true, timeLeftMinutes: 999, usedTodayMinutes: usedThisApp, usedTotalMinutes: usedTotal };
  }

  let effectiveLimit: number;
  if (limit === null) {
    effectiveLimit = userTotalCap! - (usedTotal - usedThisApp);
  } else if (userTotalCap === null) {
    effectiveLimit = limit;
  } else {
    const remainingTotal = userTotalCap - (usedTotal - usedThisApp);
    effectiveLimit = Math.min(limit, Math.max(0, remainingTotal));
  }

  if (effectiveLimit <= 0) {
    return { allowed: false, timeLeftMinutes: 0, usedTodayMinutes: usedThisApp, usedTotalMinutes: usedTotal };
  }

  const timeLeft = Math.max(0, effectiveLimit - usedThisApp);
  return {
    allowed: usedThisApp < effectiveLimit,
    timeLeftMinutes: timeLeft,
    usedTodayMinutes: usedThisApp,
    usedTotalMinutes: usedTotal,
  };
}

/** Blob key for playtime usage: encoded email + date (JST). */
export function playtimeBlobKey(email: string, date: string): string {
  return `${encodeKey(email)}/${date}`;
}
