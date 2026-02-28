import { useState } from 'react';
import { useAccessConfig } from '../hooks/useAccessConfig';
import type { Blackout } from '../types';
import './Global.css';

export default function Global() {
  const { config, loading, error, updateConfig } = useAccessConfig();
  const [newEmail, setNewEmail] = useState('');
  const [blackoutForm, setBlackoutForm] = useState<Partial<Blackout>>({ start: '', end: '', reason: '' });

  if (loading) return <p>Loading config…</p>;
  if (error) return <p className="error">Error: {error}</p>;

  const allowlist = config.allowlist ?? [];
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

  const toggleDefaultAllow = async () => {
    await updateConfig({ defaultAllow: !config.defaultAllow });
  };

  const addBlackout = async () => {
    if (!blackoutForm.start || !blackoutForm.end) return;
    const entry: Blackout = {
      start: blackoutForm.start,
      end: blackoutForm.end,
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
        <h2>Blackouts</h2>
        <p className="muted">Block all apps during these periods (except allowlisted users).</p>
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
