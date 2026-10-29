// Public endpoints for the "Worked / Didn't work" community feedback on redeem codes.
//
//   POST /api/public/redeem-codes/vote       { code, verdict: 'worked'|'failed'|'clear', device? }
//   GET  /api/public/redeem-codes/my-votes   (signed-in players: my recent votes, for a second device)
//
// Players may be signed in (verified accounts count most) or anonymous (a random device id kept
// in the browser, weighted lower). Both are throttled per voter and per network. The scoring and
// the rules that keep admins in charge live in lib/redeem-signal.js and lib/redeemVotes.mjs.

import { ensureRedeemSchema } from './lib/redeem.js';
import { SIGNAL, networkKey, accountWeight } from './lib/redeem-signal.js';
import { castVote, VoteError, hashIdentity, myVotes, hasRecentVote } from './lib/redeemVotes.mjs';

export const VOTE_PATH = '/api/public/redeem-codes/vote';
export const MINE_PATH = '/api/public/redeem-codes/my-votes';

const MAX_BODY_BYTES = 2048;
const DEVICE_RE = /^[0-9a-f-]{16,64}$/i;

const noStore = { 'cache-control': 'no-store' };

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new VoteError('That request is too large.', 413, 'too_large');
  try {
    const data = JSON.parse(text || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    throw new VoteError('Send valid JSON.', 400, 'bad_json');
  }
}

/** A signed-in player when the request carries a valid session, otherwise null (never an error). */
async function signedInPlayer(request, env, accountContext) {
  if (!/^Bearer\s+\S+/i.test(request.headers.get('authorization') || '')) return null;
  try {
    const context = await accountContext(request, env);
    return context?.account?.id ? context : null;
  } catch (error) {
    console.warn('[REDEEM_VOTE_ACCOUNT]', error?.message);
    return null;
  }
}

async function identify(db, request, body, player) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const netHash = ip ? await hashIdentity(db, 'net', networkKey(ip)) : '';

  if (player) {
    return {
      netHash,
      voter: {
        key: `a:${player.account.id}`,
        kind: 'account',
        weight: accountWeight({ verified: Boolean(player.user?.email_confirmed_at), createdAt: player.user?.created_at }),
      },
    };
  }

  const device = typeof body.device === 'string' && DEVICE_RE.test(body.device) ? body.device : '';
  if (!device && !ip) throw new VoteError('Could not identify this browser. Reload the page and try again.', 400, 'bad_voter');
  // A random per-browser id keeps two players behind one shared mobile IP apart. Without it we
  // fall back to the network alone (one voice per network).
  const key = device ? await hashIdentity(db, 'dev', device) : await hashIdentity(db, 'ip', networkKey(ip));
  return { netHash, voter: { key: `g:${key}`, kind: 'guest', weight: SIGNAL.weights.guest } };
}

/**
 * Returns a Response for the two vote endpoints, or null for any other path.
 * Dependencies are injected (as for the giveaway and league routes) so worker.mjs stays small.
 */
export async function redeemVoteWorkerRoute({ request, env, url, ctx, json, d1, accountContext, purgePublicCache }) {
  if (url.pathname !== VOTE_PATH && url.pathname !== MINE_PATH) return null;

  try {
    if (url.pathname === MINE_PATH) {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
      const player = await signedInPlayer(request, env, accountContext);
      if (!player) return json({ votes: {} });
      const db = await d1(env);
      await ensureRedeemSchema(db);
      return json({ votes: await myVotes(db, `a:${player.account.id}`) });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
    // Same-site JSON only: a cross-site form post cannot send this content type or origin.
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) {
      return json({ error: 'Send JSON.', code: 'bad_content_type' }, 415);
    }
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Cross-site requests are not allowed.', code: 'forbidden' }, 403);

    const body = await readBody(request);
    const db = await d1(env);
    await ensureRedeemSchema(db);

    const player = await signedInPlayer(request, env, accountContext);
    const { voter, netHash } = await identify(db, request, body, player);

    const result = await castVote(db, {
      code: body.code,
      verdict: String(body.verdict ?? ''),
      voter,
      netHash,
    });

    // The edge copy of the public snapshot is purged only when something players can SEE as a
    // state changed. Counters catch up within the cache TTL, so a vote storm costs no D1 reads.
    if (result.publicChanged) {
      const purge = purgePublicCache(url.origin);
      if (ctx?.waitUntil) ctx.waitUntil(purge); else await purge;
    }

    return json({
      ok: true,
      vote: result.vote,
      at: result.at,
      changed: result.changed,
      account: voter.kind === 'account',
      community: result.signal,
    }, 200, noStore);
  } catch (error) {
    if (error instanceof VoteError) return json({ error: error.message, code: error.code }, error.status, noStore);
    console.error('[REDEEM_VOTE]', error?.message);
    return json({ error: 'Your report could not be saved right now. Try again shortly.', code: 'server_error' }, 500, noStore);
  }
}

/** Quest verification: did this account really vote on this code lately? */
export async function accountVotedRecently(db, accountId, code) {
  await ensureRedeemSchema(db);
  return hasRecentVote(db, `a:${accountId}`, code);
}
