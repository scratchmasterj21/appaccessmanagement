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
4. Deploy. The SPA redirects are handled by `netlify.toml`.

## Firebase data shape

Under `accessConfig`:

- `defaultAllow`: boolean
- `allowlist`: string[] (emails)
- `apps`: `{ [appId]: { schedule: { weekdays?, weekends?, monday?…sunday? } } }`
- `users`: `{ [email]: { [appId]: { blocked?, reason?, schedule? } } }`
- `blackouts`: `{ start, end, reason? }[]` (ISO datetimes)

**Key encoding:** Firebase Realtime DB keys cannot contain `.` `#` `$` `/` `[` `]`. This app encodes those characters in `apps` and `users` keys when writing and decodes when reading. When you switch the checkaccess worker to read from Firebase, use the same decode logic in `src/lib/firebaseKeys.ts`.

This matches the `AccessConfig` type used by checkaccess. When you’re ready, you can change the worker to load config from Firebase instead of `rules.ts` (no changes done in this repo for that).
