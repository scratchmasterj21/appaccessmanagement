import { useState } from 'react';
import { useAccessConfig } from '../hooks/useAccessConfig';
import ScheduleEditor from '../components/ScheduleEditor';
import type { AppConfig, Schedule } from '../types';
import './Apps.css';

/** Default schedule so Firebase gets non-empty data (no empty arrays). */
const DEFAULT_NEW_APP_SCHEDULE: Schedule = {
  weekdays: [{ start: '09:00', end: '17:00' }],
  weekends: [{ start: '10:00', end: '18:00' }],
};

export default function Apps() {
  const { config, loading, error, updateConfig } = useAccessConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAppId, setNewAppId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  if (loading) return <p>Loading config…</p>;

  const apps = config.apps ?? {};
  const appIds = Object.keys(apps);

  const addApp = async () => {
    const id = newAppId.trim().toLowerCase().replace(/\s+/g, '') || '';
    if (!id || apps[id]) return;
    setAddError(null);
    try {
      await updateConfig({
        apps: { ...apps, [id]: { schedule: DEFAULT_NEW_APP_SCHEDULE } },
      });
      setNewAppId('');
      setEditingId(id);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  const updateApp = async (appId: string, appConfig: AppConfig) => {
    await updateConfig({
      apps: { ...apps, [appId]: appConfig },
    });
  };

  const deleteApp = (appId: string) => async () => {
    const next = { ...apps };
    delete next[appId];
    await updateConfig({ apps: next });
    setEditingId(null);
  };

  const setSchedule = (appId: string) => (schedule: Schedule) => {
    updateApp(appId, { ...apps[appId], schedule });
  };

  const setAppBlocked = (appId: string) => (blocked: boolean, reason?: string) => {
    updateApp(appId, { ...apps[appId], blocked, reason: reason ?? apps[appId].reason });
  };

  return (
    <div className="apps-page">
      <h1>Apps</h1>
      <p className="muted">Configure time-based access per app. Schedule times are in <strong>JST (Japan Standard Time)</strong>. Add an app and set its schedule.</p>

      {error && <p className="error banner">Error: {error}</p>}
      {addError && <p className="error banner">Add failed: {addError}</p>}

      <div className="add-row card-inline">
        <input
          type="text"
          placeholder="App ID (e.g. minecraft, roblox)"
          value={newAppId}
          onChange={(e) => setNewAppId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addApp()}
        />
        <button type="button" onClick={addApp}>Add app</button>
      </div>

      <ul className="app-list">
        {appIds.map((appId) => (
          <li key={appId} className="app-card">
            <div className="app-header">
              <strong>{appId}</strong>
              <div>
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === appId ? null : appId)}
                >
                  {editingId === appId ? 'Hide schedule' : 'Edit schedule'}
                </button>
                <button type="button" className="danger" onClick={deleteApp(appId)}>
                  Delete
                </button>
              </div>
            </div>
            <div className="playtime-limit-inline">
              <label>
                Daily playtime limit (min):{' '}
                <input
                  type="number"
                  min={0}
                  placeholder="default"
                  value={apps[appId].dailyPlaytimeLimitMinutes ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const num = v === '' ? undefined : Math.max(0, parseInt(v, 10));
                    updateApp(appId, { ...apps[appId], dailyPlaytimeLimitMinutes: num });
                  }}
                />
              </label>
              <span className="muted small">0 or empty = use global default</span>
            </div>
            <label className="block-toggle">
              <input
                type="checkbox"
                checked={!!apps[appId].blocked}
                onChange={(e) => setAppBlocked(appId)(e.target.checked)}
              />
              Block app (disabled for everyone except allowlisted)
            </label>
            {apps[appId].blocked && (
              <input
                type="text"
                className="block-reason"
                placeholder="Reason (optional)"
                value={apps[appId].reason ?? ''}
                onChange={(e) => setAppBlocked(appId)(true, e.target.value)}
              />
            )}
            {editingId === appId && !apps[appId].blocked && (
              <ScheduleEditor
                schedule={apps[appId].schedule}
                onChange={setSchedule(appId)}
              />
            )}
            {editingId === appId && apps[appId].blocked && (
              <p className="muted small">Unblock the app to edit its schedule.</p>
            )}
          </li>
        ))}
      </ul>

      {appIds.length === 0 && (
        <p className="empty">No apps yet. Add one above.</p>
      )}
    </div>
  );
}
