import { createClient } from '@supabase/supabase-js';

export const ACCOUNT_SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
export const ACCOUNT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_twe_ZNKiHXUB4b_J_RjGEa_rPKZrqbr';
export const ACCOUNT_SUPABASE_LEGACY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY3pncnd4dGZleGRianRoeHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mzk5ODgsImV4cCI6MjEwNjAxNTk4OH0.sStj8u_mbUE2wUcVdKZyZemG3rLQEh4RrC4A8qnmbs';

export const accountAuth = createClient(
  ACCOUNT_SUPABASE_URL,
  ACCOUNT_SUPABASE_PUBLISHABLE_KEY,
  {
    global: { headers: { apikey: ACCOUNT_SUPABASE_PUBLISHABLE_KEY } },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'fcmobiletools-auth-v1'
    }
  }
);

export async function accountApi(path, options = {}) {
  const { data } = await accountAuth.auth.getSession();
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (data.session?.access_token) headers.set('authorization', 'Bearer ' + data.session.access_token);
  return fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
}

export function isInvalidApiKeyError(error) {
  return /invalid api key|api key is invalid/i.test(String(error?.message || error || ''));
}

export async function runAuthWithFallback(operation) {
  try {
    return await operation(accountAuth);
  } catch (error) {
    if (!isInvalidApiKeyError(error)) throw error;
    const fallback = createClient(ACCOUNT_SUPABASE_URL, ACCOUNT_SUPABASE_LEGACY_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fcmobiletools-auth-v1' },
      global: { headers: { apikey: ACCOUNT_SUPABASE_LEGACY_ANON_KEY } }
    });
    return operation(fallback);
  }
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
