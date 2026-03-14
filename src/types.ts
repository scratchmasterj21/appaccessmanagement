// Aligned with checkaccess types - same structure for Firebase Realtime DB

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

export interface AppConfig {
  schedule: Schedule;
  /** When true, app is disabled for everyone (allowlisted users can still bypass in checkaccess). */
  blocked?: boolean;
  reason?: string;
  /** Daily playtime limit (minutes) for this app. Overrides global default. */
  dailyPlaytimeLimitMinutes?: number;
}

export interface UserAppOverride {
  blocked?: boolean;
  reason?: string;
  schedule?: Schedule;
  /** Per-user per-app daily playtime limit (minutes). Overrides app limit for this user. */
  dailyPlaytimeLimitMinutes?: number;
}

/** Per-user daily playtime cap (total across all apps). */
export interface UserLimit {
  dailyPlaytimeLimitMinutes?: number;
}

/** Per-user daily cap (minutes) for limited-allowlist users. They bypass schedule/block but are limited by this total. */
export interface LimitedAllowlistEntry {
  dailyPlaytimeLimitMinutes: number;
  /** Optional: can only play until this time (JST), e.g. "21:00". Inclusive. Empty = no time limit. */
  allowedUntilTime?: string;
}

export interface Blackout {
  start: string; // ISO datetime
  end: string;
  reason?: string;
}

export interface AccessConfig {
  defaultAllow: boolean;
  apps: Record<string, AppConfig>;
  users?: Record<string, Record<string, UserAppOverride>>;
  blackouts?: Blackout[];
  allowlist?: string[];
  /** Users who bypass schedule and app block but have a daily time cap (total across all apps). */
  limitedAllowlist?: Record<string, LimitedAllowlistEntry>;
  /** Global default daily playtime limit (minutes) per app. Use 0 or omit for no limit. */
  dailyPlaytimeLimitMinutes?: number;
  /** Per-user overrides: total daily cap (minutes across all apps). */
  userLimits?: Record<string, UserLimit>;
}

export const DAYS: (keyof Schedule)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

export const DEFAULT_ACCESS_CONFIG: AccessConfig = {
  defaultAllow: false,
  apps: {},
  users: {},
  blackouts: [],
  allowlist: [],
  limitedAllowlist: {},
  userLimits: {},
};
