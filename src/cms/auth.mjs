import { findUser, verifyPassword } from './users.mjs';

export const ORDER = { writer: 1, editor: 2, owner: 3 };

const COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
// Fixed-format dummy hash so unknown usernames still perform PBKDF2 work.
const DUMMY_HASH = 'pbkdf2$100000$8zmZlseMati5RrOAtXNafA$CA6rknGnHi_rg0HsPuv0YuWubV_Z5sRqRmTPk7soUN0';

const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

const enc = v => { const b = typeof v === 'string' ? new TextEncoder().encode(v) : v; let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); };
const dec = v => { v = String(v || '').replaceAll('-', '+').replaceAll('_', '/'); v += '='.repeat((4 - v.length % 4) % 4); return Uint8Array.from(atob(v), c => c.charCodeAt(0)); };

async function hmacKey(env) {
  const secret = env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(payload, env) {
  const key = await hmacKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return enc(new Uint8Array(sig));
}

async function verifySig(payload, sig, env) {
  try {
    const key = await hmacKey(env);
    return await crypto.subtle.verify('HMAC', key, dec(sig), new TextEncoder().encode(payload));
  } catch { return false; }
}

function cookieValue(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

export async function issue(user, env) {
  const payload = enc(JSON.stringify({ u: user.username, sv: user.sessionVersion, exp: Date.now() + MAX_AGE * 1000 }));
  const sig = await sign(payload, env);
  return `${payload}.${sig}`;
}

export async function read(req, env) {
  const token = cookieValue(req, COOKIE);
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!(await verifySig(payload, sig, env))) return null;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(dec(payload))); } catch { return null; }
  if (!data.u || !data.exp || Date.now() > data.exp) return null;
  const user = await findUser(env, data.u);
  if (!user || !user.active || user.sessionVersion !== data.sv) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function requireUser(req, env, minRole) {
  const user = await read(req, env);
  if (!user) return { error: json({ error: 'Authentication required' }, 401) };
  if (minRole && ORDER[user.role] < ORDER[minRole]) return { error: json({ error: 'Forbidden' }, 403) };
  return { user };
}

export async function login(req, env) {
  if (!sameOrigin(req)) return json({ error: 'Invalid request origin' }, 403);
  const body = await req.json().catch(() => null);
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  if (!username || !password) return json({ error: 'Username and password are required' }, 400);
  const user = await findUser(env, username);
  const ok = await verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) return json({ error: 'Invalid username or password' }, 401);
  const token = await issue(user, env);
  const { passwordHash, ...safeUser } = user;
  return json({ ok: true, user: safeUser }, 200, {
    'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`
  });
}

export function logout() {
  return json({ ok: true }, 200, {
    'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  });
}
