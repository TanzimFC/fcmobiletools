import { createClient } from '@supabase/supabase-js';

export const ACCOUNT_SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';

// Browser Auth uses the project's active legacy anon key. Supabase documents the
// legacy anon key as supported through the end of 2026 while projects migrate
// to the newer publishable-key system.
export const ACCOUNT_SUPABASE_CLIENT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY3pncnd4dGZleGRianRoeHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mzk5ODgsImV4cCI6MjEwNjAxNTk4OH0.sStj8u_mbUE2wUcVdKZyZemG3rLQEh4RrC4A8qnmbs';

export const accountAuth = createClient(
  ACCOUNT_SUPABASE_URL,
  ACCOUNT_SUPABASE_CLIENT_KEY,
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
