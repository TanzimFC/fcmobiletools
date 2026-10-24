// Public site-notification configuration.
// The OneSignal App ID is public. Set it as the PUBLIC_ONESIGNAL_APP_ID
// repository variable used by the production build. Never put an API key here.
const rawAppId = String(import.meta.env.PUBLIC_ONESIGNAL_APP_ID || '').trim();

export const ONESIGNAL_APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAppId)
  ? rawAppId
  : '';

export const ONESIGNAL_ENABLED = Boolean(ONESIGNAL_APP_ID);
