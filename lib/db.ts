import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
});

export async function query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
}

import { unstable_cache } from 'next/cache';

// Cached database reads. The cache key includes the site's data version (bumped after every admin write,
// lib/refresh-site.ts), so reads made after a write are fresh. No cache tag: a shared tag would make every
// page on the site depend on it, and clearing it would mark all ~37,000 pages stale at once.
export const cachedQuery = unstable_cache(
    async (text: string, paramsStr?: string, _dataVersion?: string) => {
        const params = paramsStr ? JSON.parse(paramsStr) : undefined;
        const res = await pool.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount };
    },
    ['cached-db-query-v3'],
    { revalidate: 86400 }
);

// The version is read at most every few seconds per server instance
let versionMemo = { value: '0', at: 0 };
async function dataVersion(): Promise<string> {
    if (Date.now() - versionMemo.at < 3000) return versionMemo.value;
    try {
        const res = await pool.query('SELECT version FROM site_data_version WHERE id = 1');
        versionMemo = { value: String(res.rows[0]?.version ?? 0), at: Date.now() };
    } catch {
        versionMemo = { value: versionMemo.value, at: Date.now() };
    }
    return versionMemo.value;
}

/** After an admin write: later cached reads miss the cache and see the change. */
export async function bumpDataVersion() {
    const res = await pool.query('UPDATE site_data_version SET version = version + 1, updated_at = now() WHERE id = 1 RETURNING version');
    versionMemo = { value: String(res.rows[0]?.version ?? Date.now()), at: Date.now() };
}

export async function queryCached(text: string, params?: any[]) {
    return await cachedQuery(text, params ? JSON.stringify(params) : undefined, await dataVersion());
}
