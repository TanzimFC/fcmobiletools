import { createClient } from '@supabase/supabase-js';

export const ACCOUNT_SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
export const ACCOUNT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_twe_ZNKiHXUB4b_J_RjGEa_rPKZrqbr';

export const accountAuth = createClient(
  ACCOUNT_SUPABASE_URL,
  ACCOUNT_SUPABASE_PUBLISHABLE_KEY,
  {
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

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
