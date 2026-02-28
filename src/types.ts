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
}

export interface UserAppOverride {
  blocked?: boolean;
  reason?: string;
  schedule?: Schedule;
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
};
