/**
 * Get the playtime-usage Blob store.
 * Pass the handler event so connectLambda(event) can run in Lambda compatibility mode.
 * For local dev without Netlify context, set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in .env.
 */

import { connectLambda, getStore } from '@netlify/blobs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPlaytimeStore(event?: any) {
  if (event != null) {
    try {
      connectLambda(event);
    } catch {
      // ignore if event shape doesn't support Blobs context
    }
  }
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'playtime-usage', siteID, token });
  }
  return getStore({ name: 'playtime-usage' });
}
