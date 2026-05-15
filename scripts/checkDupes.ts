import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log("Truncating nominations to reload adapted sources...");
    await pool.query('TRUNCATE TABLE nominations CASCADE');
    console.log("Truncated!");
    process.exit(0);
}

main();
