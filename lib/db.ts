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

export const cachedQuery = unstable_cache(
    async (text: string, paramsStr?: string) => {
        const params = paramsStr ? JSON.parse(paramsStr) : undefined;
        const res = await pool.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount };
    },
    ['cached-db-query'],
    { revalidate: 86400 }
);

export async function queryCached(text: string, params?: any[]) {
    return await cachedQuery(text, params ? JSON.stringify(params) : undefined);
}
