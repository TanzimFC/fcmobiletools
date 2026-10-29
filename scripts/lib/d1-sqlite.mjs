// A tiny Cloudflare D1 look-alike backed by Node's built-in SQLite.
// D1 *is* SQLite, so tests run the real SQL from src/lib/*.mjs instead of a hand-written mock.
// Supports the subset the app uses: prepare().bind().first()/all()/run(), and db.batch().

import { DatabaseSync } from 'node:sqlite';

export function createD1() {
  const sqlite = new DatabaseSync(':memory:');

  const returnsRows = (sql) => /^\s*(select|with|pragma)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const make = (sql, params = []) => ({
    bind: (...args) => make(sql, args),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params), meta: {} }),
    run: async () => {
      const info = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(info.changes) } };
    },
    async _execute() {
      if (returnsRows(sql)) return { success: true, results: sqlite.prepare(sql).all(...params), meta: {} };
      const info = sqlite.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(info.changes) } };
    },
  });

  return {
    sqlite,
    prepare: (sql) => make(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const statement of statements) out.push(await statement._execute());
        sqlite.exec('COMMIT');
        return out;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
