# App Access Management

Frontend to manage app access rules (allowlist, app schedules, user overrides, blackouts). Data is stored in **Firebase Realtime Database** and follows the same structure used by the [checkaccess](https://github.com/your-org/checkaccess) worker.

## Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Firebase**
   - Create a `.env` from `.env.example` and fill in your Firebase config (same values you use for the main app).
   - **Important:** `VITE_FIREBASE_DATABASE_URL` must be the **exact** URL of the Realtime Database you're using (e.g. `https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app`). If your project has more than one database, the app uses this URL to choose which one to write to. In Firebase Console → Realtime Database, open the correct database and copy its URL from the top.
   - In [Firebase Console](https://console.firebase.google.com) → Realtime Database → Rules, deploy the rules from `database.rules.json`:
     - Read `accessConfig`: allowed for everyone (so the checkaccess worker can fetch config without auth).
     - Write `accessConfig`: only authenticated users.

3. **Run locally**
   ```bash
   npm run dev
   ```
   Sign in with Google (same domain as your admin accounts). All edits are saved to Firebase.

## Deploy to Netlify

1. Connect this repo to Netlify.
2. Build settings (usually auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
3. In Site settings → Environment variables, add all `VITE_FIREBASE_*` variables from `.env.example`.
   - For the **Netlify Functions** (check-access, playtime-heartbeat), also set **`FIREBASE_DATABASE_URL`** (or they will use `VITE_FIREBASE_DATABASE_URL`) so the check-access function can read config from Firebase.
4. Deploy. The SPA redirects are handled by `netlify.toml`. Functions in `netlify/functions/` are deployed automatically.

### Single access-check API (schedule + playtime)

This repo includes Netlify Functions that act as the **single** place to check access:

- **`GET/POST /.netlify/functions/check-access`** — Query params or JSON body: `email`, `appId`. Returns `{ allowed, reason?, timeLeftMinutes, usedTodayMinutes, scheduleAllowed, playtimeAllowed }`. Combines schedule, blocked, blackouts, allowlist, and daily playtime limits.
- **`POST /.netlify/functions/playtime-heartbeat`** — JSON body: `{ email, appId, minutesToAdd }`. Records playtime for today (JST) in Netlify Blob storage.

Your student app should call **only** `check-access` for “can I play?” and call `playtime-heartbeat` periodically (e.g. every 5 minutes) while the app is in use. Playtime usage is stored in Netlify Blob (not Firebase).

## Firebase data shape

Under `accessConfig`:

- `defaultAllow`: boolean
- `allowlist`: string[] (emails)
- `apps`: `{ [appId]: { schedule, blocked?, reason?, dailyPlaytimeLimitMinutes? } }`
- `users`: `{ [email]: { [appId]: { blocked?, reason?, schedule?, dailyPlaytimeLimitMinutes? } } }`
- `blackouts`: `{ start, end, reason? }[]` (ISO datetimes)
- `dailyPlaytimeLimitMinutes`: number (global default per-app daily limit; 0 = no limit)
- `userLimits`: `{ [email]: { dailyPlaytimeLimitMinutes? } }` (per-user total daily cap across all apps)

**Key encoding:** Firebase Realtime DB keys cannot contain `.` `#` `$` `/` `[` `]`. This app encodes those characters in `apps` and `users` keys when writing and decodes when reading. When you switch the checkaccess worker to read from Firebase, use the same decode logic in `src/lib/firebaseKeys.ts`. The Netlify `check-access` function uses matching logic in `netlify/functions/_shared/accessCheck.ts`.

This matches the `AccessConfig` type used by checkaccess. When you’re ready, you can change the worker to load config from Firebase instead of `rules.ts` (no changes done in this repo for that).
