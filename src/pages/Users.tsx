import { useState } from 'react';
import { useAccessConfig } from '../hooks/useAccessConfig';
import ScheduleEditor from '../components/ScheduleEditor';
import type { UserAppOverride, Schedule } from '../types';
import './Users.css';

/** Placeholder so Firebase gets non-empty data for a new user (no overrides yet). Filter out when displaying. */
const NEW_USER_PLACEHOLDER_KEY = '_';
const NEW_USER_PLACEHOLDER: Record<string, UserAppOverride> = { [NEW_USER_PLACEHOLDER_KEY]: { blocked: false } };

export default function Users() {
  const { config, loading, error, updateConfig } = useAccessConfig();
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null); // "${email}::${appId}"
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newAppId, setNewAppId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  if (loading) return <p>Loading config…</p>;

  const users = config.users ?? {};
  const appIds = Object.keys(config.apps ?? {});
  const userEmails = Object.keys(users);

  const addUser = async () => {
    const email = newUserEmail.trim().toLowerCase();
    if (!email || users[email]) return;
    setAddError(null);
    try {
      await updateConfig({
        users: { ...users, [email]: NEW_USER_PLACEHOLDER },
      });
      setNewUserEmail('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeUser = (email: string) => async () => {
    const next = { ...users };
    delete next[email];
    await updateConfig({ users: next });
      };

  const addOverride = async (email: string) => {
    const appId = newAppId.trim().toLowerCase();
    if (!appId) return;
    const userOverrides = users[email] ?? {};
    if (userOverrides[appId]) return;
    await updateConfig({
      users: {
        ...users,
        [email]: { ...userOverrides, [appId]: { blocked: false } },
      },
    });
    setNewAppId('');
    setExpandedOverride(`${email}::${appId}`);
  };

  const updateOverride = (email: string, appId: string) => (override: UserAppOverride) => {
    const userOverrides = { ...(users[email] ?? {}) };
    userOverrides[appId] = override;
    updateConfig({
      users: { ...users, [email]: userOverrides },
    });
  };

  const removeOverride = (email: string, appId: string) => async () => {
    const userOverrides = { ...(users[email] ?? {}) };
    delete userOverrides[appId];
    const next = { ...users, [email]: userOverrides };
    if (Object.keys(userOverrides).length === 0) {
      delete next[email];
    }
    await updateConfig({ users: next });
    setExpandedOverride(null);
  };

  const setBlocked = (email: string, appId: string) => (blocked: boolean, reason?: string) => {
    const current = users[email]?.[appId] ?? {};
    updateOverride(email, appId)({ ...current, blocked, reason: reason ?? current.reason });
  };

  const setSchedule = (email: string, appId: string) => (schedule: Schedule) => {
    const current = users[email]?.[appId] ?? {};
    updateOverride(email, appId)({ ...current, schedule });
  };

  return (
    <div className="users-page">
      <h1>User overrides</h1>
      <p className="muted">Block users from specific apps or give them custom schedules.</p>

      {error && <p className="error banner">Error: {error}</p>}
      {addError && <p className="error banner">Add failed: {addError}</p>}

      <div className="add-row card-inline">
        <input
          type="email"
          placeholder="User email"
          value={newUserEmail}
          onChange={(e) => setNewUserEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUser()}
        />
        <button type="button" onClick={addUser}>Add user</button>
      </div>

      <ul className="user-list">
        {userEmails.map((email) => (
          <li key={email} className="user-card">
            <div className="user-header">
              <strong>{email}</strong>
              <button
                type="button"
                className="danger"
                onClick={removeUser(email)}
              >
                Remove user
              </button>
            </div>
            <div className="user-overrides">
              <div className="add-override">
                <span>Add override for app:</span>
                <select
                  value={newAppId}
                  onChange={(e) => setNewAppId(e.target.value)}
                >
                  <option value="">Select app</option>
                  {appIds.map((id) => (
                    <option key={id} value={id} disabled={!!users[email]?.[id]}>
                      {id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addOverride(email)}
                  disabled={!newAppId || !!users[email]?.[newAppId]}
                >
                  Add
                </button>
              </div>
              {Object.entries(users[email] ?? {}).filter(([appId]) => appId !== NEW_USER_PLACEHOLDER_KEY).map(([appId, override]) => (
                <div key={appId} className="override-block">
                  <div className="override-header">
                    <strong>{appId}</strong>
                    <button
                      type="button"
                      className="danger small"
                      onClick={removeOverride(email, appId)}
                    >
                      Remove override
                    </button>
                  </div>
                  <label className="block-toggle">
                    <input
                      type="checkbox"
                      checked={!!override.blocked}
                      onChange={(e) => setBlocked(email, appId)(e.target.checked)}
                    />
                    Blocked
                  </label>
                  {override.blocked && (
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={override.reason ?? ''}
                      onChange={(e) =>
                        updateOverride(email, appId)({ ...override, reason: e.target.value })
                      }
                    />
                  )}
                  {!override.blocked && (
                    <div className="override-schedule">
                      <button
                        type="button"
                        onClick={() => {
                          const key = `${email}::${appId}`;
                          setExpandedOverride(expandedOverride === key ? null : key);
                        }}
                      >
                        {expandedOverride === `${email}::${appId}` ? 'Hide custom schedule' : 'Edit custom schedule'}
                      </button>
                      {expandedOverride === `${email}::${appId}` && (
                        <ScheduleEditor
                          schedule={override.schedule ?? {}}
                          onChange={setSchedule(email, appId)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {userEmails.length === 0 && (
        <p className="empty">No user overrides. Add a user above.</p>
      )}
    </div>
  );
}
