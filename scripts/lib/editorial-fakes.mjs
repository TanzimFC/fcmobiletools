import assert from 'node:assert/strict';

// In-memory stand-ins for Supabase REST and the GitHub contents API, used by the tests and the local demo server.
export function makeBackend() {
  const tables = { articles: [], article_revisions: [], article_reviews: [], article_comments: [], editorial_inbox: [], editorial_settings: [] };
  const ids = {}; const repo = new Map(); const commits = [];
  const filterRows = (rows, params) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
      const m = v.match(/^(eq|neq|in|is|like|lte|gte)\.(.*)$/); if (!m) continue;
      const [, op, val] = m;
      rows = rows.filter((r) => {
        const cur = r[k];
        if (op === 'eq') return String(cur) === val;
        if (op === 'neq') return String(cur) !== val;
        if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map(decodeURIComponent).includes(String(cur));
        if (op === 'is') return val === 'null' ? cur == null : cur != null;
        if (op === 'like') return String(cur).startsWith(decodeURIComponent(val).replace(/\*$/, ''));
        if (op === 'lte') return String(cur) <= decodeURIComponent(val);
        return true;
      });
    }
    return rows;
  };
  const pick = (row, select) => {
    if (!select || select === '*') return { ...row };
    const out = {}; for (const c of select.split(',')) out[c] = row[c]; return out;
  };
  async function rest(env, p, opts = {}) {
    const [table, query = ''] = p.split('?');
    const params = [...new URLSearchParams(query).entries()].map(([k, v]) => [k, decodeURIComponent(v.replace(/%2C/g, ','))]);
    const rows = tables[table]; assert.ok(rows, 'unknown table ' + table);
    const select = new URLSearchParams(query).get('select');
    const method = opts.method || 'GET';
    const wantRows = /representation/.test(opts.headers?.Prefer || '');
    if (method === 'GET') {
      let out = filterRows(rows, params);
      const order = new URLSearchParams(query).get('order');
      if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1)); }
      const off = Number(new URLSearchParams(query).get('offset') || 0); const lim = Number(new URLSearchParams(query).get('limit') || 1000);
      return out.slice(off, off + lim).map((r) => pick(r, select));
    }
    if (method === 'POST') {
      const body = JSON.parse(opts.body); const made = [];
      for (const item of body) {
        if (table === 'articles' && rows.some((r) => r.slug === item.slug)) throw new Error('duplicate key value violates unique constraint');
        if (table === 'article_revisions' && rows.some((r) => r.article_id === item.article_id && r.revision_no === item.revision_no)) throw new Error('duplicate key value');
        ids[table] = (ids[table] || 0) + 1;
        const row = { id: ids[table], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: 1, deploy_state: 'none', ...item };
        rows.push(row); made.push(pick(row, select));
      }
      return wantRows ? made : null;
    }
    if (method === 'PATCH') {
      const body = JSON.parse(opts.body); const hit = filterRows(rows, params);
      hit.forEach((r) => Object.assign(r, body));
      return wantRows ? hit.map((r) => pick(r, select)) : null;
    }
    if (method === 'DELETE') { for (const r of filterRows(rows, params)) rows.splice(rows.indexOf(r), 1); return null; }
    throw new Error('unsupported ' + method);
  }
  async function github(env, p, opts = {}) {
    const m = p.match(/^contents\/([^?]+)/);
    if (m) {
      const file = decodeURIComponent(m[1]);
      if (!opts.method) { if (!repo.has(file)) throw new Error('Not Found'); return { sha: repo.get(file).sha, content: Buffer.from(repo.get(file).text, 'utf8').toString('base64') }; }
      const body = JSON.parse(opts.body);
      if (opts.method === 'DELETE') { repo.delete(file); commits.push({ op: 'delete', file }); return { commit: { sha: 'c' + commits.length } }; }
      const existing = repo.get(file);
      if (existing && existing.sha !== body.sha) throw new Error(file + ' does not match ' + body.sha);
      const text = new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)));
      const sha = 's' + (commits.length + 1); repo.set(file, { text, sha }); commits.push({ op: 'put', file, message: body.message, author: body.author });
      return { commit: { sha: 'c' + commits.length }, content: { sha } };
    }
    if (/check-runs/.test(p)) return { check_runs: [] };
    throw new Error('unhandled github call ' + p);
  }
  return { rest, github, tables, repo, commits };
}
