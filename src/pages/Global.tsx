import { useState } from 'react';
import { useAccessConfig } from '../hooks/useAccessConfig';
import type { Blackout } from '../types';
import './Global.css';

export default function Global() {
  const { config, loading, error, updateConfig } = useAccessConfig();
  const [newEmail, setNewEmail] = useState('');
  const [limitedEmail, setLimitedEmail] = useState('');
  const [limitedMinutes, setLimitedMinutes] = useState<string>('');
  const [blackoutForm, setBlackoutForm] = useState<Partial<Blackout>>({ start: '', end: '', reason: '' });

  if (loading) return <p>Loading config…</p>;
  if (error) return <p className="error">Error: {error}</p>;

  const allowlist = config.allowlist ?? [];
  const limitedAllowlist = config.limitedAllowlist ?? {};
  const blackouts = config.blackouts ?? [];

  const addAllowlist = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || allowlist.includes(email)) return;
    await updateConfig({ allowlist: [...allowlist, email] });
    setNewEmail('');
  };

  const removeAllowlist = (email: string) => async () => {
    await updateConfig({ allowlist: allowlist.filter((e) => e !== email) });
  };

  const addLimitedAllowlist = async () => {
    const email = limitedEmail.trim().toLowerCase();
    const minutes = Math.max(1, parseInt(limitedMinutes, 10) || 0);
    if (!email || minutes <= 0) return;
    await updateConfig({
      limitedAllowlist: { ...limitedAllowlist, [email]: { dailyPlaytimeLimitMinutes: minutes } },
    });
    setLimitedEmail('');
    setLimitedMinutes('');
  };

  const removeLimitedAllowlist = (email: string) => async () => {
    const next = { ...limitedAllowlist };
    delete next[email];
    await updateConfig({ limitedAllowlist: next });
  };

  const updateLimitedAllowlistMinutes = (email: string, minutes: number) => {
    if (minutes <= 0) {
      const next = { ...limitedAllowlist };
      delete next[email];
      updateConfig({ limitedAllowlist: next });
    } else {
      updateConfig({
        limitedAllowlist: { ...limitedAllowlist, [email]: { dailyPlaytimeLimitMinutes: minutes } },
      });
    }
  };

  const toggleDefaultAllow = async () => {
    await updateConfig({ defaultAllow: !config.defaultAllow });
  };

  /** Treat datetime-local value (YYYY-MM-DDTHH:mm) as JST and store as ISO with offset. */
  const toJSTISO = (v: string): string => {
    if (!v) return v;
    if (/[Z+]/.test(v)) return v; // already has timezone
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
    return `${withSeconds}+09:00`;
  };

  const addBlackout = async () => {
    if (!blackoutForm.start || !blackoutForm.end) return;
    const entry: Blackout = {
      start: toJSTISO(blackoutForm.start),
      end: toJSTISO(blackoutForm.end),
      reason: blackoutForm.reason?.trim() || undefined,
    };
    await updateConfig({ blackouts: [...blackouts, entry] });
    setBlackoutForm({ start: '', end: '', reason: '' });
  };

  const removeBlackout = (index: number) => async () => {
    await updateConfig({ blackouts: blackouts.filter((_, i) => i !== index) });
  };

  return (
    <div className="global-page">
      <h1>Global settings</h1>

      <section className="card">
        <h2>Daily playtime limit (global default)</h2>
        <p className="muted">Default daily playtime per app (minutes). Use 0 or leave empty for no limit. Overridden by per-app and per-user settings.</p>
        <div className="add-row">
          <input
            type="number"
            min={0}
            placeholder="e.g. 120 (2 hours)"
            value={config.dailyPlaytimeLimitMinutes && config.dailyPlaytimeLimitMinutes > 0 ? config.dailyPlaytimeLimitMinutes : ''}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === '' ? 0 : Math.max(0, parseInt(v, 10));
              updateConfig({ dailyPlaytimeLimitMinutes: num });
            }}
          />
          <span className="muted">minutes per app per day</span>
        </div>
      </section>

      <section className="card">
        <h2>Default allow</h2>
        <p className="muted">When an app has no rules, allow or deny access by default.</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.defaultAllow}
            onChange={toggleDefaultAllow}
          />
          <span>{config.defaultAllow ? 'Allow' : 'Deny'} by default</span>
        </label>
      </section>

      <section className="card">
        <h2>Allowlist (admins)</h2>
        <p className="muted">These users can access any app at any time.</p>
        <div className="add-row">
          <input
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAllowlist()}
          />
          <button type="button" onClick={addAllowlist}>Add</button>
        </div>
        <ul className="list">
          {allowlist.map((email) => (
            <li key={email}>
              <span>{email}</span>
              <button type="button" className="danger" onClick={removeAllowlist(email)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Limited allowlist</h2>
        <p className="muted">These users can access any app at any time (bypass schedule and app block) but have a daily time cap (total across all apps).</p>
        <div className="add-row">
          <input
            type="email"
            placeholder="email@example.com"
            value={limitedEmail}
            onChange={(e) => setLimitedEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLimitedAllowlist()}
          />
          <input
            type="number"
            min={1}
            placeholder="Daily cap (min)"
            value={limitedMinutes}
            onChange={(e) => setLimitedMinutes(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLimitedAllowlist()}
          />
          <button type="button" onClick={addLimitedAllowlist}>Add</button>
        </div>
        <ul className="list">
          {Object.entries(limitedAllowlist).map(([email, entry]) => (
            <li key={email}>
              <span>{email}</span>
              <input
                type="number"
                min={1}
                className="small-input"
                value={entry.dailyPlaytimeLimitMinutes}
                onChange={(e) => updateLimitedAllowlistMinutes(email, Math.max(1, parseInt(e.target.value, 10) || 0))}
              />
              <span className="muted">min/day total</span>
              <button type="button" className="danger" onClick={removeLimitedAllowlist(email)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Blackouts</h2>
        <p className="muted">Block all apps during these periods (except allowlisted users). Start and end times are in <strong>JST (Japan Standard Time)</strong>.</p>
        <div className="blackout-form">
          <input
            type="datetime-local"
            placeholder="Start"
            value={blackoutForm.start}
            onChange={(e) => setBlackoutForm((f) => ({ ...f, start: e.target.value }))}
          />
          <input
            type="datetime-local"
            placeholder="End"
            value={blackoutForm.end}
            onChange={(e) => setBlackoutForm((f) => ({ ...f, end: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={blackoutForm.reason ?? ''}
            onChange={(e) => setBlackoutForm((f) => ({ ...f, reason: e.target.value }))}
          />
          <button type="button" onClick={addBlackout}>Add blackout</button>
        </div>
        <ul className="list">
          {blackouts.map((b, i) => (
            <li key={i}>
              <span>{b.start} – {b.end} {b.reason ? `(${b.reason})` : ''}</span>
              <button type="button" className="danger" onClick={removeBlackout(i)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
