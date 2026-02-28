import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';
import type { AccessConfig } from '../types';
import { ACCESS_CONFIG_PATH } from '../firebase';
import { accessConfigFromFirebase, accessConfigToFirebase, replaceEmptyArraysForFirebase, stripUndefined } from '../lib/firebaseKeys';

const configRef = () => ref(db, ACCESS_CONFIG_PATH);

/** Encode a single top-level field for Firebase (apps/users need key encoding). */
function encodeField(
  key: keyof AccessConfig,
  value: AccessConfig[keyof AccessConfig]
): unknown {
  if (value === undefined) return undefined;
  const config: AccessConfig = {
    defaultAllow: false,
    apps: {},
    users: {},
    blackouts: [],
    allowlist: [],
    [key]: value,
  };
  const encoded = accessConfigToFirebase(config);
  return encoded[key];
}

export function useAccessConfig() {
  const [config, setConfig] = useState<AccessConfig>({
    defaultAllow: false,
    apps: {},
    users: {},
    blackouts: [],
    allowlist: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(
      configRef(),
      (snap) => {
        const val = snap.val();
        if (import.meta.env.DEV) {
          console.log('[accessConfig] Received:', val != null ? Object.keys(val as object) : 'null', val);
        }
        setConfig(accessConfigFromFirebase(val));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const updateConfig = useCallback(async (updates: Partial<AccessConfig>) => {
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(updates) as (keyof AccessConfig)[]) {
      if (updates[key] === undefined) continue;
      const val = encodeField(key, updates[key]!);
      if (val !== undefined) payload[key] = val;
    }
    if (Object.keys(payload).length === 0) return;
    try {
      const withNoEmptyArrays = replaceEmptyArraysForFirebase(payload) as Record<string, unknown>;
      const payloadForFirebase = stripUndefined(withNoEmptyArrays) as Record<string, unknown>;
      if (import.meta.env.DEV) {
        console.log('[accessConfig] Writing:', Object.keys(payloadForFirebase), payloadForFirebase);
      }
      await update(ref(db, ACCESS_CONFIG_PATH), payloadForFirebase);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  const setConfigFull = useCallback(async (next: AccessConfig) => {
    setError(null);
    try {
      await set(configRef(), accessConfigToFirebase(next));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  return { config, loading, error, updateConfig, setConfigFull };
}
