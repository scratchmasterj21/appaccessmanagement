/**
 * Firebase Realtime Database keys cannot contain . # $ / [ ]
 * Encode/decode so we can store emails (e.g. user@domain.com) and app IDs safely.
 */

import type { AccessConfig, AppConfig, Schedule, UserAppOverride, Blackout } from '../types';

const MAP: [string, string][] = [
  ['.', '__DOT__'],
  ['#', '__HASH__'],
  ['$', '__DOLLAR__'],
  ['/', '__SLASH__'],
  ['[', '__OB__'],
  [']', '__CB__'],
];

export function encodeKey(key: string): string {
  let s = key;
  for (const [char, placeholder] of MAP) {
    s = s.split(char).join(placeholder);
  }
  return s;
}

export function decodeKey(key: string): string {
  let s = key;
  for (const [char, placeholder] of MAP) {
    s = s.split(placeholder).join(char);
  }
  return s;
}

/** Encode keys of a shallow object (one level). */
function encodeShallow<T>(obj: Record<string, T> | null | undefined): Record<string, T> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, T> = {};
  for (const k of Object.keys(obj)) {
    out[encodeKey(k)] = obj[k];
  }
  return out;
}

/** Firebase sometimes returns arrays as objects { "0": a, "1": b }. Normalize to array. */
function toArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== 'object') return [];
  const o = val as Record<string, T>;
  const keys = Object.keys(o).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => o[k]);
}

const SCHEDULE_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'weekdays', 'weekends'] as const;

/** Normalize schedule from Firebase: {} or { "0": x } → [] for each day key. */
function normalizeSchedule(schedule: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!schedule || typeof schedule !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of SCHEDULE_KEYS) {
    const v = schedule[k];
    out[k] = Array.isArray(v) ? v : toArray(v);
  }
  return out;
}

/** Firebase does not store empty arrays []; they break or disappear. Replace [] with {} before writing. */
export function replaceEmptyArraysForFirebase(val: unknown): unknown {
  if (Array.isArray(val)) return val.length === 0 ? {} : val.map(replaceEmptyArraysForFirebase);
  if (val != null && typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = replaceEmptyArraysForFirebase(o[k]);
    return out;
  }
  return val;
}

/** Firebase rejects undefined. Strip any key whose value is undefined before writing. */
export function stripUndefined(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (Array.isArray(val)) return val.map(stripUndefined);
  if (val != null && typeof val === 'object') {
    const o = val as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const v = stripUndefined(o[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return val;
}

/** Transform config from Firebase (encoded keys) to app shape (decoded keys). */
export function accessConfigFromFirebase(raw: unknown): AccessConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      defaultAllow: false,
      apps: {},
      users: {},
      blackouts: [],
      allowlist: [],
    };
  }
  const o = raw as Record<string, unknown>;
  // Only treat as object: not null, not array (Firebase can return arrays for some paths)
  const appsRaw =
    o.apps != null && typeof o.apps === 'object' && !Array.isArray(o.apps)
      ? (o.apps as Record<string, AppConfig>)
      : {};
  const apps: Record<string, AppConfig> = {};
  for (const encK of Object.keys(appsRaw)) {
    const app = appsRaw[encK];
    const decoded: AppConfig = {
      ...app,
      schedule: normalizeSchedule(app?.schedule as Record<string, unknown>) as Schedule,
    };
    apps[decodeKey(encK)] = decoded;
  }
  const usersRaw =
    o.users != null && typeof o.users === 'object' && !Array.isArray(o.users)
      ? (o.users as Record<string, Record<string, UserAppOverride>>)
      : {};
  const users: Record<string, Record<string, UserAppOverride>> = {};
  for (const encEmail of Object.keys(usersRaw)) {
    const email = decodeKey(encEmail);
    const inner = usersRaw[encEmail];
    const overrides: Record<string, UserAppOverride> = {};
    if (inner && typeof inner === 'object') {
      for (const encAppId of Object.keys(inner)) {
        const ov = inner[encAppId];
        const decoded: UserAppOverride = { ...ov };
        if (ov?.schedule != null && typeof ov.schedule === 'object') {
          decoded.schedule = normalizeSchedule(ov.schedule as Record<string, unknown>) as Schedule;
        }
        overrides[decodeKey(encAppId)] = decoded;
      }
    }
    users[email] = overrides;
  }
  return {
    defaultAllow: Boolean(o.defaultAllow),
    apps,
    users,
    blackouts: toArray<Blackout>(o.blackouts),
    allowlist: toArray<string>(o.allowlist),
  };
}

/** Transform config to Firebase shape (encoded keys for apps and users). */
export function accessConfigToFirebase(config: AccessConfig): Record<string, unknown> {
  const appsEnc: Record<string, AppConfig> = {};
  for (const k of Object.keys(config.apps || {})) {
    appsEnc[encodeKey(k)] = config.apps[k];
  }
  const usersEnc: Record<string, Record<string, UserAppOverride>> = {};
  for (const email of Object.keys(config.users || {})) {
    usersEnc[encodeKey(email)] = encodeShallow(config.users![email]);
  }
  return {
    defaultAllow: config.defaultAllow,
    apps: appsEnc,
    users: usersEnc,
    blackouts: config.blackouts ?? [],
    allowlist: config.allowlist ?? [],
  };
}
